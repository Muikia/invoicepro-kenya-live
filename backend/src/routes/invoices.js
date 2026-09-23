const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified } = require('../middleware/auth');
const { money, nextInvoiceNumber } = require('../utils/money');
const { receiptHtml, receiptUrl } = require('../utils/receipt');
const { receiptPdfBuffer } = require('../utils/pdf');
const { verifyToken } = require('../utils/jwt');
const { sendEmail } = require('../utils/email');
const { hasFeature, upgradeError } = require('../utils/features');
const { computeInvoiceTotals } = require('../utils/vat');
const { publicAppUrl } = require('../utils/config');

const router = express.Router();

const PAYMENT_METHODS = ['cash', 'mpesa', 'card'];
const STATUSES = ['unpaid', 'partial', 'paid'];
const FREE_INVOICE_LIMIT = 10;

function shareUrl(invoice) {
  const base = publicAppUrl() || 'http://localhost:5173';
  if (!invoice.receipt_share_token) return receiptUrl(invoice.id);
  return `${base}/receipt/${invoice.id}?share=${encodeURIComponent(invoice.receipt_share_token)}`;
}

function newShareToken() {
  return crypto.randomBytes(16).toString('hex');
}

function serializeInvoice(invoice) {
  return {
    ...invoice,
    total_kes: Number(invoice.total_kes),
    paid_amount: Number(invoice.paid_amount || 0),
    vat_rate: Number(invoice.vat_rate || 0),
    subtotal_kes: Number(invoice.subtotal_kes ?? invoice.total_kes),
    vat_amount_kes: Number(invoice.vat_amount_kes || 0),
    total_kes_after_vat: Number(invoice.total_kes_after_vat ?? invoice.total_kes),
    is_repeat_customer: Number(invoice.visit_count || invoice.customer_visit_count || 0) > 1,
    receipt_url: receiptUrl(invoice.id),
    share_url: shareUrl(invoice),
  };
}

function serializeItem(item) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_kes: Number(item.total_kes),
    vat_exempt: Boolean(item.vat_exempt),
  };
}

async function adjustStockForInvoice(trx, invoiceId, direction) {
  const links = await trx('invoice_to_inventory as l')
    .join('invoice_items as ii', 'ii.id', 'l.invoice_item_id')
    .where('ii.invoice_id', invoiceId)
    .select('l.inventory_item_id', 'l.quantity_sold');

  for (const link of links) {
    const sold = Number(link.quantity_sold || 0);
    const delta = direction === 'decrement' ? -sold : sold;
    await trx('inventory_items')
      .where({ id: link.inventory_item_id })
      .update({
        quantity_in_stock: trx.raw('GREATEST(quantity_in_stock + ?, 0)', [delta]),
        updated_at: trx.fn.now(),
      });
  }
}

function whatsappMessage({ user, customer, invoice, items, link }) {
  const itemLines = items
    .map((item) => `${item.description} x${item.quantity} - KSh ${Number(item.total_kes)}`)
    .join('\n');
  return `Hi ${customer.name}! Here's your receipt from ${user.business_name}:

Invoice: ${invoice.invoice_number}
Date: ${new Date(invoice.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
Items: ${itemLines}

Total: KSh ${Number(invoice.total_kes)}
Paid: ${invoice.payment_method || invoice.payment_status}

Thank you for your business!
${link}`;
}

function paymentStatus(paidAmount, total) {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= total) return 'paid';
  return 'partial';
}

async function monthlyInvoiceCount(userId, trx = db) {
  const row = await trx('invoices')
    .where({ user_id: userId })
    .andWhereRaw("created_at >= DATE_TRUNC('month', NOW())")
    .count('* as count')
    .first();
  return Number(row.count);
}

function parseItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const error = new Error('Add at least one invoice item');
    error.status = 400;
    throw error;
  }

  return rawItems.map((item, index) => {
    const description = String(item.description || '').trim();
    const quantity = Number(item.quantity);
    const unit_price = Number(item.unit_price);

    if (!description) {
      const error = new Error(`Item ${index + 1}: description is required`);
      error.status = 400;
      throw error;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      const error = new Error(`Item ${index + 1}: quantity must be a whole number of 1 or more`);
      error.status = 400;
      throw error;
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      const error = new Error(`Item ${index + 1}: unit price must be 0 or more`);
      error.status = 400;
      throw error;
    }

    return {
      description,
      quantity,
      unit_price: money(unit_price),
      total_kes: money(quantity * unit_price),
      vat_exempt: Boolean(item.vat_exempt),
      inventory_item_id: item.inventory_item_id ? String(item.inventory_item_id) : null,
    };
  });
}

router.get('/:id/receipt', async (req, res, next) => {
  try {
    let userId = null;

    if (req.query.token) {
      try {
        const payload = verifyToken(String(req.query.token), 'receipt');
        if (payload.invoiceId !== req.params.id) {
          return res.status(400).json({ error: 'Invalid receipt link' });
        }
      } catch (err) {
        return res.status(400).json({ error: 'Receipt link is invalid or has expired' });
      }
    } else {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        return res.status(401).json({ error: 'Login required' });
      }
      try {
        const payload = verifyToken(token, 'auth');
        userId = payload.userId;
      } catch (err) {
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      }
    }

    const invoiceQuery = db('invoices').where({ id: req.params.id });
    if (userId) {
      invoiceQuery.andWhere({ user_id: userId });
    }
    const invoice = await invoiceQuery.first();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [user, customer, items] = await Promise.all([
      db('users').where({ id: invoice.user_id }).first(),
      db('customers').where({ id: invoice.customer_id }).first(),
      db('invoice_items').where({ invoice_id: invoice.id }).orderBy('created_at', 'asc'),
    ]);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(receiptHtml({ user, customer, invoice, items }));
  } catch (err) {
    return next(err);
  }
});

router.use(requireAuth);
router.use(requireEmailVerified);

router.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const range = String(req.query.range || '').trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    let query = db('invoices as i')
      .join('customers as c', 'c.id', 'i.customer_id')
      .where('i.user_id', req.user.id)
      .select(
        'i.*',
        'c.name as customer_name',
        'c.phone as customer_phone',
        'c.visit_count as customer_visit_count'
      )
      .orderBy('i.created_at', 'desc');

    if (status && STATUSES.includes(status)) {
      query = query.andWhere('i.payment_status', status);
    }

    if (range === 'week') {
      query = query.andWhereRaw("i.created_at >= DATE_TRUNC('week', NOW())");
    } else if (range === 'month') {
      query = query.andWhereRaw("i.created_at >= DATE_TRUNC('month', NOW())");
    } else if (month && month >= 1 && month <= 12) {
      query = query
        .andWhereRaw('EXTRACT(MONTH FROM i.created_at) = ?', [month])
        .andWhereRaw('EXTRACT(YEAR FROM i.created_at) = ?', [year]);
    }

    if (from && !Number.isNaN(from.getTime())) {
      query = query.andWhere('i.created_at', '>=', from);
    }
    if (to && !Number.isNaN(to.getTime())) {
      query = query.andWhere('i.created_at', '<=', to);
    }

    const invoices = await query;
    return res.json({ invoices: invoices.map(serializeInvoice) });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await db('invoices as i')
      .join('customers as c', 'c.id', 'i.customer_id')
      .where({ 'i.id': req.params.id, 'i.user_id': req.user.id })
      .select(
        'i.*',
        'c.name as customer_name',
        'c.phone as customer_phone',
        'c.email as customer_email',
        'c.visit_count as customer_visit_count',
        'c.total_spent_kes as customer_total_spent_kes'
      )
      .first();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const items = await db('invoice_items')
      .where({ invoice_id: invoice.id })
      .orderBy('created_at', 'asc');

    return res.json({
      invoice: {
        ...serializeInvoice(invoice),
        receipt_url: receiptUrl(invoice.id),
      },
      items: items.map(serializeItem),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const customer_id = String(req.body.customer_id || '').trim();
    const notes = String(req.body.notes || '').trim() || null;
    const payment_method = String(req.body.payment_method || '').trim() || null;

    if (!customer_id) {
      return res.status(400).json({ error: 'Select a customer' });
    }
    if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Payment method must be cash, mpesa, or card' });
    }

    let items;
    try {
      items = parseItems(req.body.items);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const vatEnabled = hasFeature(req.user, 'vat') && Boolean(req.body.apply_vat);
    let vatRate = 0;
    if (vatEnabled) {
      const settings = await db('vat_settings').where({ user_id: req.user.id }).first();
      vatRate =
        req.body.vat_rate !== undefined && req.body.vat_rate !== null && req.body.vat_rate !== ''
          ? Number(req.body.vat_rate)
          : Number(settings?.default_vat_rate || 16);
      if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
        return res.status(400).json({ error: 'VAT rate must be between 0 and 100' });
      }
    }

    let totals;
    try {
      totals = computeInvoiceTotals(items, {
        discountType: req.body.discount_type,
        discountValue: req.body.discount_value,
        vatRate,
        vatEnabled,
      });
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const result = await db.transaction(async (trx) => {
      if (req.user.subscription_tier === 'free') {
        const used = await monthlyInvoiceCount(req.user.id, trx);
        if (used >= FREE_INVOICE_LIMIT) {
          const error = new Error('Upgrade to Basic (KSh 500/month) for unlimited invoices');
          error.status = 403;
          error.code = 'UPGRADE_REQUIRED';
          throw error;
        }
      }

      const customer = await trx('customers')
        .where({ id: customer_id, user_id: req.user.id })
        .first();
      if (!customer) {
        const error = new Error('Customer not found');
        error.status = 404;
        throw error;
      }

      const counter = await trx('invoice_counters')
        .where({ user_id: req.user.id })
        .forUpdate()
        .first();

      const currentCount = counter ? Number(counter.current_count) + 1 : 1;
      if (counter) {
        await trx('invoice_counters').where({ user_id: req.user.id }).update({
          current_count: currentCount,
        });
      } else {
        await trx('invoice_counters').insert({
          user_id: req.user.id,
          current_count: currentCount,
        });
      }

      const inventoryIds = [...new Set(items.map((item) => item.inventory_item_id).filter(Boolean))];
      if (inventoryIds.length) {
        const owned = await trx('inventory_items')
          .where({ user_id: req.user.id })
          .whereIn('id', inventoryIds);
        if (owned.length !== inventoryIds.length) {
          const error = new Error('One or more inventory items were not found');
          error.status = 400;
          throw error;
        }
      }

      const invoice_number = nextInvoiceNumber(currentCount);
      const [invoice] = await trx('invoices')
        .insert({
          user_id: req.user.id,
          customer_id: customer.id,
          invoice_number,
          total_kes: totals.total_kes,
          paid_amount: 0,
          payment_status: 'unpaid',
          payment_method,
          notes,
          vat_rate: totals.vat_rate,
          subtotal_kes: totals.subtotal_kes,
          vat_amount_kes: totals.vat_amount_kes,
          total_kes_after_vat: totals.total_kes_after_vat,
          receipt_share_token: newShareToken(),
        })
        .returning('*');

      const insertedItems = await trx('invoice_items')
        .insert(
          items.map(({ inventory_item_id, ...item }) => ({
            ...item,
            invoice_id: invoice.id,
          }))
        )
        .returning('*');

      const links = [];
      insertedItems.forEach((row, index) => {
        if (items[index].inventory_item_id) {
          links.push({
            invoice_item_id: row.id,
            inventory_item_id: items[index].inventory_item_id,
            quantity_sold: items[index].quantity,
          });
        }
      });
      if (links.length) {
        await trx('invoice_to_inventory').insert(links);
      }

      await trx('customers')
        .where({ id: customer.id })
        .update({
          total_spent_kes: money(Number(customer.total_spent_kes || 0) + totals.total_kes),
          visit_count: Number(customer.visit_count || 0) + 1,
          last_visit_date: trx.fn.now(),
          updated_at: trx.fn.now(),
        });

      const updatedCustomer = await trx('customers').where({ id: customer.id }).first();

      return { invoice, items: insertedItems, customer: updatedCustomer };
    });

    return res.status(201).json({
      invoice: {
        ...serializeInvoice({
          ...result.invoice,
          customer_name: result.customer.name,
          customer_phone: result.customer.phone,
          customer_visit_count: result.customer.visit_count,
        }),
        receipt_url: receiptUrl(result.invoice.id),
      },
      items: result.items.map(serializeItem),
      customer: result.customer,
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db('invoices')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const updates = { updated_at: db.fn.now() };

    if (req.body.notes !== undefined) {
      updates.notes = String(req.body.notes || '').trim() || null;
    }

    if (req.body.payment_method !== undefined) {
      const payment_method = String(req.body.payment_method || '').trim() || null;
      if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({ error: 'Payment method must be cash, mpesa, or card' });
      }
      updates.payment_method = payment_method;
    }

    if (req.body.paid_amount !== undefined) {
      const paid_amount = money(req.body.paid_amount);
      if (paid_amount < 0) {
        return res.status(400).json({ error: 'Paid amount cannot be negative' });
      }
      updates.paid_amount = paid_amount;
      updates.payment_status = paymentStatus(paid_amount, Number(existing.total_kes));
    }

    const [invoice] = await db('invoices').where({ id: existing.id }).update(updates).returning('*');
    return res.json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await db.transaction(async (trx) => {
      const invoice = await trx('invoices')
        .where({ id: req.params.id, user_id: req.user.id })
        .first();
      if (!invoice) {
        const error = new Error('Invoice not found');
        error.status = 404;
        throw error;
      }

      const customer = await trx('customers').where({ id: invoice.customer_id }).first();
      if (customer) {
        await trx('customers')
          .where({ id: customer.id })
          .update({
            total_spent_kes: Math.max(0, money(Number(customer.total_spent_kes || 0) - Number(invoice.total_kes))),
            visit_count: Math.max(0, Number(customer.visit_count || 0) - 1),
            updated_at: trx.fn.now(),
          });
      }

      if (invoice.payment_status === 'paid') {
        await adjustStockForInvoice(trx, invoice.id, 'increment');
      }

      await trx('invoices').where({ id: invoice.id }).del();
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/mark-paid', async (req, res, next) => {
  try {
    const invoice = await db('invoices')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const amount =
      req.body.amount !== undefined ? money(req.body.amount) : Number(invoice.total_kes);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const payment_method = String(req.body.payment_method || invoice.payment_method || 'cash');
    if (!PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: 'Payment method must be cash, mpesa, or card' });
    }

    const paid_amount = money(Math.min(Number(invoice.total_kes), Number(invoice.paid_amount || 0) + amount));
    const status = paymentStatus(paid_amount, Number(invoice.total_kes));

    const updated = await db.transaction(async (trx) => {
      const [row] = await trx('invoices')
        .where({ id: invoice.id })
        .update({
          paid_amount,
          payment_status: status,
          payment_method,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      await trx('payments').insert({
        invoice_id: invoice.id,
        amount_kes: amount,
        payment_method,
        mpesa_receipt_code: req.body.mpesa_receipt_code || null,
      });

      if (status === 'paid' && invoice.payment_status !== 'paid') {
        await adjustStockForInvoice(trx, invoice.id, 'decrement');
      }

      return row;
    });

    return res.json({ invoice: serializeInvoice(updated) });
  } catch (err) {
    return next(err);
  }
});

async function loadOwnedInvoice(req) {
  const invoice = await db('invoices as i')
    .join('customers as c', 'c.id', 'i.customer_id')
    .where({ 'i.id': req.params.id, 'i.user_id': req.user.id })
    .select('i.*', 'c.name as customer_name', 'c.phone as customer_phone', 'c.email as customer_email')
    .first();
  if (!invoice) {
    const error = new Error('Invoice not found');
    error.status = 404;
    throw error;
  }
  const [user, customer, items] = await Promise.all([
    db('users').where({ id: invoice.user_id }).first(),
    db('customers').where({ id: invoice.customer_id }).first(),
    db('invoice_items').where({ invoice_id: invoice.id }).orderBy('created_at', 'asc'),
  ]);
  return { invoice, user, customer, items };
}

router.get('/:id/receipt-pdf', async (req, res, next) => {
  try {
    const payload = await loadOwnedInvoice(req);
    const pdf = await receiptPdfBuffer(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.invoice.invoice_number}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/send-email', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'receipts_share')) {
      throw upgradeError('Upgrade to Basic (KSh 500/month) to email receipts');
    }
    const payload = await loadOwnedInvoice(req);
    const to_email = String(req.body.to_email || payload.customer.email || '').trim();
    if (!to_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
      return res.status(400).json({ error: 'A valid customer email is required' });
    }
    if (!payload.invoice.receipt_share_token) {
      const token = newShareToken();
      await db('invoices').where({ id: payload.invoice.id }).update({ receipt_share_token: token });
      payload.invoice.receipt_share_token = token;
    }
    const link = shareUrl(payload.invoice);
    const result = await sendEmail({
      to: to_email,
      subject: `Receipt ${payload.invoice.invoice_number} from ${payload.user.business_name}`,
      text: `Your receipt is ready: ${link}`,
      html: receiptHtml({
        ...payload,
        invoice: payload.invoice,
      }),
    });
    return res.json({ success: true, sent: result.sent, to_email });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/whatsapp-link', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'receipts_share')) {
      throw upgradeError('Upgrade to Basic (KSh 500/month) to share WhatsApp receipts');
    }
    const payload = await loadOwnedInvoice(req);
    if (!payload.invoice.receipt_share_token) {
      const token = newShareToken();
      await db('invoices').where({ id: payload.invoice.id }).update({ receipt_share_token: token });
      payload.invoice.receipt_share_token = token;
    }
    const link = shareUrl(payload.invoice);
    return res.json({
      shareLink: link,
      message: whatsappMessage({ ...payload, link }),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
