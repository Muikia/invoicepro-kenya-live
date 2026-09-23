const express = require('express');
const db = require('../db');
const { receiptHtml } = require('../utils/receipt');
const { receiptPdfBuffer } = require('../utils/pdf');

const router = express.Router();

async function loadPublicReceipt(invoiceId, shareToken) {
  const token = String(shareToken || '').trim();
  if (!token) {
    const error = new Error('Receipt link is invalid or has expired');
    error.status = 400;
    throw error;
  }

  const invoice = await db('invoices')
    .where({ id: invoiceId, receipt_share_token: token })
    .first();
  if (!invoice) {
    const error = new Error('Receipt not found');
    error.status = 404;
    throw error;
  }

  const [user, customer, items] = await Promise.all([
    db('users').where({ id: invoice.user_id }).first(),
    db('customers').where({ id: invoice.customer_id }).first(),
    db('invoice_items').where({ invoice_id: invoice.id }).orderBy('created_at', 'asc'),
  ]);

  return { user, customer, invoice, items };
}

router.get('/receipt/:invoiceId/:shareToken', async (req, res, next) => {
  try {
    const payload = await loadPublicReceipt(req.params.invoiceId, req.params.shareToken);
    if (String(req.query.format || '') === 'pdf') {
      const pdf = await receiptPdfBuffer(payload);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${payload.invoice.invoice_number}.pdf"`
      );
      return res.send(pdf);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(receiptHtml(payload));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
