const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified } = require('../middleware/auth');
const { hasFeature, upgradeError } = require('../utils/features');
const { DEFAULT_VAT_RATE } = require('../utils/vat');

const router = express.Router();
router.use(requireAuth);
router.use(requireEmailVerified);

async function settingsForUser(userId) {
  const row = await db('vat_settings').where({ user_id: userId }).first();
  return (
    row || {
      user_id: userId,
      business_vat_registered: false,
      vat_pin: null,
      default_vat_rate: DEFAULT_VAT_RATE,
    }
  );
}

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await settingsForUser(req.user.id);
    return res.json({
      settings: {
        business_vat_registered: Boolean(settings.business_vat_registered),
        vat_pin: settings.vat_pin || '',
        default_vat_rate: Number(settings.default_vat_rate || DEFAULT_VAT_RATE),
      },
      upgrade_required: !hasFeature(req.user, 'vat'),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/settings', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'vat')) {
      throw upgradeError('Upgrade to Basic (KSh 500/month) for VAT compliance');
    }

    const business_vat_registered = Boolean(req.body.business_vat_registered);
    const vat_pin = String(req.body.vat_pin || '').trim() || null;
    let default_vat_rate = Number(req.body.default_vat_rate);
    if (!Number.isFinite(default_vat_rate) || default_vat_rate < 0 || default_vat_rate > 100) {
      default_vat_rate = DEFAULT_VAT_RATE;
    }

    const existing = await db('vat_settings').where({ user_id: req.user.id }).first();
    let settings;
    if (existing) {
      [settings] = await db('vat_settings')
        .where({ id: existing.id })
        .update({ business_vat_registered, vat_pin, default_vat_rate })
        .returning('*');
    } else {
      [settings] = await db('vat_settings')
        .insert({
          user_id: req.user.id,
          business_vat_registered,
          vat_pin,
          default_vat_rate,
        })
        .returning('*');
    }

    return res.json({
      settings: {
        business_vat_registered: Boolean(settings.business_vat_registered),
        vat_pin: settings.vat_pin || '',
        default_vat_rate: Number(settings.default_vat_rate || DEFAULT_VAT_RATE),
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/report', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'vat')) {
      return res.json({
        upgrade_required: true,
        month: null,
        year: null,
        total_sales: 0,
        total_vat_collected: 0,
        invoices: [],
      });
    }

    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be 1-12' });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Enter a valid year' });
    }

    const invoices = await db('invoices as i')
      .join('customers as c', 'c.id', 'i.customer_id')
      .where('i.user_id', req.user.id)
      .andWhereRaw('EXTRACT(MONTH FROM i.created_at) = ?', [month])
      .andWhereRaw('EXTRACT(YEAR FROM i.created_at) = ?', [year])
      .select(
        'i.id',
        'i.invoice_number',
        'i.created_at',
        'i.subtotal_kes',
        'i.vat_amount_kes',
        'i.total_kes',
        'i.total_kes_after_vat',
        'i.vat_rate',
        'i.payment_status',
        'c.name as customer_name'
      )
      .orderBy('i.created_at', 'asc');

    const total_sales = invoices.reduce(
      (sum, row) => sum + Number(row.total_kes_after_vat ?? row.total_kes ?? 0),
      0
    );
    const total_vat_collected = invoices.reduce((sum, row) => sum + Number(row.vat_amount_kes || 0), 0);

    await db.raw(
      `
      INSERT INTO vat_reports (user_id, month, year, total_sales, total_vat_collected, generated_date)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (user_id, month, year)
      DO UPDATE SET total_sales = EXCLUDED.total_sales,
                    total_vat_collected = EXCLUDED.total_vat_collected,
                    generated_date = NOW()
      `,
      [req.user.id, month, year, total_sales, total_vat_collected]
    );

    return res.json({
      upgrade_required: false,
      month,
      year,
      total_sales,
      total_vat_collected,
      invoices: invoices.map((row) => ({
        ...row,
        subtotal_kes: Number(row.subtotal_kes ?? row.total_kes ?? 0),
        vat_amount_kes: Number(row.vat_amount_kes || 0),
        total_kes: Number(row.total_kes || 0),
        vat_rate: Number(row.vat_rate || 0),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
