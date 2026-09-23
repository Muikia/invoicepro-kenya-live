const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, publicUser } = require('../middleware/auth');
const { normalizeKenyaPhone } = require('../utils/phone');
const { signDeletionToken, verifyToken } = require('../utils/jwt');
const { sendAccountDeletedEmail } = require('../utils/email');

const router = express.Router();
router.use(requireAuth);

const BUSINESS_TYPES = [
  'shoe_repair',
  'phone_repair',
  'tailor',
  'hardware',
  'cyber_cafe',
  'salon',
  'other',
];

router.put('/password', async (req, res, next) => {
  try {
    const currentPassword = String(req.body.current_password || '');
    const newPassword = String(req.body.new_password || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const ok = await bcrypt.compare(currentPassword, req.user.password_hash);
    if (!ok) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({
      password_hash,
      updated_at: db.fn.now(),
    });

    return res.json({ message: 'Password updated' });
  } catch (err) {
    return next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const updates = { updated_at: db.fn.now() };

    if (req.body.business_name !== undefined) {
      const business_name = String(req.body.business_name || '').trim();
      if (!business_name) {
        return res.status(400).json({ error: 'Business name is required' });
      }
      updates.business_name = business_name;
    }

    if (req.body.business_type !== undefined) {
      const business_type = String(req.body.business_type || '').trim();
      if (business_type && !BUSINESS_TYPES.includes(business_type)) {
        return res.status(400).json({ error: 'Choose a valid business type' });
      }
      updates.business_type = business_type || null;
    }

    if (req.body.preferred_verification_method !== undefined) {
      const method = String(req.body.preferred_verification_method || '').trim();
      if (!['sms', 'email', 'both'].includes(method)) {
        return res.status(400).json({ error: 'Choose sms, email, or both' });
      }
      updates.preferred_verification_method = method;
    }

    if (req.body.m_pesa_number !== undefined) {
      const raw = String(req.body.m_pesa_number || '').trim();
      if (!raw) {
        updates.m_pesa_number = null;
      } else {
        const phone = normalizeKenyaPhone(raw);
        if (!phone) {
          return res.status(400).json({ error: 'Enter a valid Kenyan M-Pesa number' });
        }
        updates.m_pesa_number = phone;
      }
    }

    const [user] = await db('users').where({ id: req.user.id }).update(updates).returning('*');
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.put('/verification-preferences', async (req, res, next) => {
  try {
    const method = String(req.body.preferred_method || req.body.preferred_verification_method || '').trim();
    if (!['sms', 'email', 'both'].includes(method)) {
      return res.status(400).json({ error: 'Choose sms, email, or both' });
    }
    const [user] = await db('users')
      .where({ id: req.user.id })
      .update({
        preferred_verification_method: method,
        updated_at: db.fn.now(),
      })
      .returning('*');
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

async function loadDeletion(req) {
  const token = String(req.body.deletion_token || '');
  if (!token) {
    const error = new Error('Deletion token is required');
    error.status = 400;
    throw error;
  }
  let payload;
  try {
    payload = verifyToken(token, 'deletion');
  } catch (err) {
    const error = new Error('Deletion request expired. Start again.');
    error.status = 400;
    throw error;
  }
  if (payload.userId !== req.user.id) {
    const error = new Error('Deletion request is invalid');
    error.status = 400;
    throw error;
  }
  const request = await db('deletion_requests')
    .where({ id: payload.requestId, user_id: req.user.id })
    .first();
  if (!request) {
    const error = new Error('Deletion request not found');
    error.status = 404;
    throw error;
  }
  return request;
}

router.post('/request-deletion', async (req, res, next) => {
  try {
    const [request] = await db('deletion_requests')
      .insert({
        user_id: req.user.id,
        status: 'pending',
        failed_attempts: 0,
      })
      .returning('*');
    const deletion_token = signDeletionToken(req.user.id, request.id);
    return res.json({ deletion_token, expires_in: 3600 });
  } catch (err) {
    return next(err);
  }
});

router.post('/confirm-deletion', async (req, res, next) => {
  try {
    const request = await loadDeletion(req);
    if (request.status === 'completed') {
      return res.status(400).json({ error: 'This deletion already completed' });
    }
    if (request.locked_until && new Date(request.locked_until).getTime() > Date.now()) {
      return res.status(429).json({
        error: 'Too many incorrect emails. Wait 5 minutes and try again.',
        retry_after: Math.ceil((new Date(request.locked_until).getTime() - Date.now()) / 1000),
      });
    }

    const typed = String(req.body.email_confirmation || '').trim().toLowerCase();
    if (typed !== String(req.user.email).toLowerCase()) {
      const failed = Number(request.failed_attempts || 0) + 1;
      const updates = { failed_attempts: failed };
      if (failed >= 3) {
        updates.locked_until = new Date(Date.now() + 5 * 60 * 1000);
        updates.status = 'cancelled';
        updates.cancellation_reason = 'too_many_failed_email_confirmations';
      }
      await db('deletion_requests').where({ id: request.id }).update(updates);
      if (failed >= 3) {
        return res.status(429).json({
          error: 'Too many incorrect emails. Wait 5 minutes and try again.',
          retry_after: 300,
        });
      }
      return res.status(400).json({ error: 'Email does not match', attempts_remaining: 3 - failed });
    }

    const [updated] = await db('deletion_requests')
      .where({ id: request.id })
      .update({
        status: 'confirmed',
        confirmed_at: db.fn.now(),
      })
      .returning('*');

    return res.json({ status: 'confirmed', delete_in_seconds: 30, confirmed_at: updated.confirmed_at });
  } catch (err) {
    return next(err);
  }
});

router.post('/complete-deletion', async (req, res, next) => {
  try {
    const request = await loadDeletion(req);
    if (request.status !== 'confirmed') {
      return res.status(400).json({ error: 'Confirm your email before deleting the account' });
    }
    const confirmedAt = request.confirmed_at ? new Date(request.confirmed_at).getTime() : 0;
    if (Date.now() < confirmedAt + 30 * 1000) {
      return res.status(400).json({
        error: 'Wait for the 30-second countdown to finish',
        delete_in_seconds: Math.ceil((confirmedAt + 30000 - Date.now()) / 1000),
      });
    }

    const snapshot = {
      email: req.user.email,
      name: req.user.business_name,
    };

    await db.transaction(async (trx) => {
      await trx('deletion_requests').where({ id: request.id }).update({
        status: 'completed',
        completed_at: trx.fn.now(),
      });
      await trx('users').where({ id: req.user.id }).del();
    });

    try {
      await sendAccountDeletedEmail(snapshot.email, snapshot.name);
    } catch (err) {
      console.error('[delete] confirmation email failed', err);
    }

    return res.json({ status: 'success' });
  } catch (err) {
    return next(err);
  }
});

router.post('/cancel-deletion', async (req, res, next) => {
  try {
    const request = await loadDeletion(req);
    if (request.status === 'completed') {
      return res.status(400).json({ error: 'This deletion already completed' });
    }
    await db('deletion_requests').where({ id: request.id }).update({
      status: 'cancelled',
      cancellation_reason: String(req.body.cancellation_reason || 'user_cancelled'),
    });
    return res.json({ status: 'cancelled' });
  } catch (err) {
    return next(err);
  }
});

router.delete('/', async (req, res) => {
  return res.status(405).json({
    error: 'Account deletion requires confirmation. Use /api/user/request-deletion.',
    code: 'DELETION_CONFIRMATION_REQUIRED',
  });
});

module.exports = router;
