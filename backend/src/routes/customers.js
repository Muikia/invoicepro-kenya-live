const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified } = require('../middleware/auth');
const { normalizeKenyaPhone } = require('../utils/phone');

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

function serializeCustomer(customer) {
  const isRepeat = Boolean(customer.is_repeat_customer);
  return {
    ...customer,
    total_spent_kes: Number(customer.total_spent_kes || 0),
    visit_count: Number(customer.visit_count || 0),
    is_repeat: isRepeat,
    is_repeat_customer: isRepeat,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = String(req.query.filter || '').trim();
    let query = db('customers').where({ user_id: req.user.id }).orderBy('created_at', 'desc');

    if (search) {
      const like = `%${search}%`;
      query = query.andWhere((builder) => {
        builder.whereILike('name', like).orWhereILike('phone', like);
      });
    }
    if (filter === 'repeat') {
      query = query.andWhere({ is_repeat_customer: true });
    } else if (filter === 'new') {
      query = query.andWhere({ is_repeat_customer: false });
    }

    const customers = await query;
    return res.json({ customers: customers.map(serializeCustomer) });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await db('customers')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const invoices = await db('invoices')
      .where({ customer_id: customer.id, user_id: req.user.id })
      .orderBy('created_at', 'desc');

    return res.json({
      customer: serializeCustomer(customer),
      invoices: invoices.map((invoice) => ({
        ...invoice,
        total_kes: Number(invoice.total_kes),
        paid_amount: Number(invoice.paid_amount || 0),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = normalizeKenyaPhone(req.body.phone);
    const email = String(req.body.email || '').trim().toLowerCase() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const isRepeat = Boolean(req.body.is_repeat_customer);

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }

    const duplicate = await db('customers')
      .where({ user_id: req.user.id, phone })
      .first();
    if (duplicate) {
      return res.status(409).json({ error: 'A customer with this phone already exists' });
    }

    const [customer] = await db('customers')
      .insert({
        user_id: req.user.id,
        name,
        phone,
        email,
        notes,
        is_repeat_customer: isRepeat,
        repeat_customer_since: isRepeat ? db.fn.now() : null,
        last_visit_date: isRepeat ? db.fn.now() : null,
        visit_count: isRepeat ? Math.max(2, Number(req.body.visit_count || 2)) : 0,
      })
      .returning('*');

    return res.status(201).json({ customer: serializeCustomer(customer) });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db('customers')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updates = { updated_at: db.fn.now() };

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      updates.name = name;
    }

    if (req.body.phone !== undefined) {
      const phone = normalizeKenyaPhone(req.body.phone);
      if (!phone) {
        return res.status(400).json({ error: 'Enter a valid Kenyan phone number' });
      }
      const duplicate = await db('customers')
        .where({ user_id: req.user.id, phone })
        .whereNot({ id: existing.id })
        .first();
      if (duplicate) {
        return res.status(409).json({ error: 'A customer with this phone already exists' });
      }
      updates.phone = phone;
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Enter a valid email' });
      }
      updates.email = email || null;
    }

    if (req.body.notes !== undefined) {
      updates.notes = String(req.body.notes || '').trim() || null;
    }

    if (req.body.is_repeat_customer !== undefined) {
      const isRepeat = Boolean(req.body.is_repeat_customer);
      updates.is_repeat_customer = isRepeat;
      updates.repeat_customer_since = isRepeat
        ? existing.repeat_customer_since || db.fn.now()
        : null;
      if (isRepeat && !existing.last_visit_date) {
        updates.last_visit_date = db.fn.now();
      }
    }

    const [customer] = await db('customers')
      .where({ id: existing.id })
      .update(updates)
      .returning('*');

    return res.json({ customer: serializeCustomer(customer) });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/mark-repeat', async (req, res, next) => {
  try {
    const existing = await db('customers')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const isRepeat = req.body.is_repeat_customer !== undefined ? Boolean(req.body.is_repeat_customer) : true;
    const [customer] = await db('customers')
      .where({ id: existing.id })
      .update({
        is_repeat_customer: isRepeat,
        repeat_customer_since: isRepeat ? existing.repeat_customer_since || db.fn.now() : null,
        last_visit_date: isRepeat && !existing.last_visit_date ? db.fn.now() : existing.last_visit_date,
        updated_at: db.fn.now(),
      })
      .returning('*');
    return res.json({ customer: serializeCustomer(customer) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await db('customers')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
