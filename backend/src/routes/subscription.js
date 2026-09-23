const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified, publicUser } = require('../middleware/auth');
const { publicAppUrl } = require('../utils/config');

const router = express.Router();
router.use(requireAuth);
router.use(requireEmailVerified);

const FREE_INVOICE_LIMIT = 10;
const BASIC_PRICE_KES = 500;
const PRO_PRICE_KES = 1500;

async function usageForUser(user) {
  const row = await db('invoices')
    .where({ user_id: user.id })
    .andWhereRaw("created_at >= DATE_TRUNC('month', NOW())")
    .count('* as count')
    .first();

  const used = Number(row.count || 0);
  const isPaid = user.subscription_tier && user.subscription_tier !== 'free';

  return {
    subscription_tier: user.subscription_tier || 'free',
    invoices_used: used,
    invoices_limit: isPaid ? null : FREE_INVOICE_LIMIT,
    invoices_remaining: isPaid ? null : Math.max(0, FREE_INVOICE_LIMIT - used),
    can_create_invoice: isPaid || used < FREE_INVOICE_LIMIT,
    price_kes: BASIC_PRICE_KES,
  };
}

router.get('/status', async (req, res, next) => {
  try {
    const usage = await usageForUser(req.user);
    return res.json(usage);
  } catch (err) {
    return next(err);
  }
});

router.post('/upgrade', async (req, res, next) => {
  try {
    if (req.user.subscription_tier && req.user.subscription_tier !== 'free') {
      return res.json({
        already_upgraded: true,
        subscription_tier: req.user.subscription_tier,
        message: 'Your account is already on a paid plan.',
      });
    }

    const frontend = publicAppUrl() || 'http://localhost:5173';
    const payment_url = process.env.PAYMENT_URL || `${frontend}/app/upgrade`;
    const tier = req.body.tier === 'pro' ? 'pro' : 'basic';

    return res.json({
      payment_url,
      amount_kes: tier === 'pro' ? PRO_PRICE_KES : BASIC_PRICE_KES,
      tier,
      message:
        tier === 'pro'
          ? 'Pay KSh 1,500 via the payment link, then confirm to unlock Pro.'
          : 'Pay KSh 500 via the payment link, then confirm to unlock unlimited invoices.',
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const requested = req.query.tier === 'pro' ? 'pro' : 'basic';
    const current = req.user.subscription_tier || 'free';
    if (current === 'pro' || (current === 'basic' && requested === 'basic')) {
      return res.json({
        success: true,
        user: publicUser(req.user),
        message: `Already on ${current}.`,
      });
    }

    const updated = await db.transaction(async (trx) => {
      const [user] = await trx('users')
        .where({ id: req.user.id })
        .update({
          subscription_tier: requested,
          subscription_date: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      await trx('subscription_logs').insert({
        user_id: req.user.id,
        from_tier: current,
        to_tier: requested,
      });

      return user;
    });

    return res.json({
      success: true,
      user: publicUser(updated),
      message:
        requested === 'pro'
          ? 'Payment confirmed. You are now on Pro.'
          : 'Payment confirmed. You now have unlimited invoices.',
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
