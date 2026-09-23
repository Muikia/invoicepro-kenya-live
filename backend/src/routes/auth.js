const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, publicUser } = require('../middleware/auth');
const { normalizeKenyaPhone } = require('../utils/phone');
const { signAuthToken, signResetToken, verifyToken } = require('../utils/jwt');
const { sendPasswordResetEmail, sendVerificationEmail, isEmailConfigured } = require('../utils/email');
const { issueCode, consumeCode } = require('../utils/codes');
const { sendPhoneVerificationSms, isSmsConfigured } = require('../utils/sms');
const { publicAppUrl } = require('../utils/config');

const router = express.Router();

const BUSINESS_TYPES = [
  'shoe_repair',
  'phone_repair',
  'tailor',
  'hardware',
  'cyber_cafe',
  'salon',
  'other',
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function verificationPayload(issued, sent, channel) {
  const label = channel === 'sms' ? 'SMS' : 'Email';
  return {
    message: sent ? `Code sent` : `${label} is not configured on this server. Use the code shown on screen.`,
    expires_in: issued.expires_in,
    email_sent: channel === 'email' ? Boolean(sent) : undefined,
    sms_sent: channel === 'sms' ? Boolean(sent) : undefined,
    preview_code: sent ? undefined : issued.code,
  };
}

async function latestLiveCode(table, userId) {
  return db(table)
    .where({ user_id: userId, used: false })
    .andWhere('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .first();
}

function passwordError(password, confirm) {
  if (String(password || '').length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include 1 uppercase letter, 1 number';
  }
  if (confirm !== undefined && confirm !== null && String(confirm) !== '' && String(confirm) !== password) {
    return 'Passwords do not match';
  }
  return null;
}

router.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const confirm_password = req.body.confirm_password ?? req.body.password_confirm;
    const business_name = String(req.body.business_name || '').trim();
    const business_type = String(req.body.business_type || '').trim();
    const phone = normalizeKenyaPhone(req.body.phone);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number' });
    }
    const passwordProblem = passwordError(password, confirm_password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
    }
    if (!business_name) {
      return res.status(400).json({ error: 'Business name is required' });
    }
    if (business_type && !BUSINESS_TYPES.includes(business_type)) {
      return res.status(400).json({ error: 'Choose a valid business type' });
    }

    const existing = await db('users')
      .where({ email })
      .orWhere({ phone })
      .first();
    if (existing) {
      const field = existing.email === email ? 'email' : 'phone';
      return res.status(409).json({ error: `An account with this ${field} already exists` });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users')
      .insert({
        email,
        phone,
        password_hash,
        business_name,
        business_type: business_type || null,
        subscription_tier: 'free',
        email_verified: true,
        email_verified_at: db.fn.now(),
        phone_verified: false,
        preferred_verification_method: 'sms',
      })
      .returning('*');

    await db('invoice_counters').insert({ user_id: user.id, current_count: 0 });

    const token = signAuthToken(user.id);
    return res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db('users').where({ email }).first();
    if (!user || user.deleted_at) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signAuthToken(user.id);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

router.post('/password-reset', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const user = await db('users').where({ email }).first();
    const generic = { message: 'If that email exists, a reset link has been sent.' };

    if (!user) {
      return res.json(generic);
    }

    const token = signResetToken(user.id);
    const frontend = publicAppUrl() || 'http://localhost:5173';
    const resetUrl = `${frontend}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    const payload = { ...generic };
    if (process.env.NODE_ENV !== 'production') {
      payload.reset_url = resetUrl;
    }
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

router.post('/verify-reset', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    const passwordProblem = passwordError(password);
    if (passwordProblem) {
      return res.status(400).json({ error: passwordProblem });
    }

    let payload;
    try {
      payload = verifyToken(token, 'password-reset');
    } catch (err) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const user = await db('users').where({ id: payload.userId }).first();
    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await db('users').where({ id: user.id }).update({
      password_hash,
      updated_at: db.fn.now(),
    });

    return res.json({ message: 'Password updated. You can now login.' });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

router.get('/verification-status', requireAuth, async (req, res, next) => {
  try {
    const emailConfigured = isEmailConfigured();
    const smsConfigured = isSmsConfigured();
    const emailCode = !req.user.email_verified
      ? await latestLiveCode('email_verification_codes', req.user.id)
      : null;
    const phoneCode = !req.user.phone_verified
      ? await latestLiveCode('phone_verification_codes', req.user.id)
      : null;
    return res.json({
      email_configured: emailConfigured,
      sms_configured: smsConfigured,
      email_verified: Boolean(req.user.email_verified),
      phone_verified: Boolean(req.user.phone_verified),
      email: req.user.email,
      phone: req.user.phone,
      email_preview_code: emailConfigured ? null : emailCode?.code || null,
      sms_preview_code: smsConfigured ? null : phoneCode?.code || null,
      email_expires_at: emailCode?.expires_at || null,
      sms_expires_at: phoneCode?.expires_at || null,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/send-email-verification', requireAuth, async (req, res, next) => {
  try {
    if (req.user.email_verified) {
      return res.json({ message: 'Email already verified', expires_in: 0, email_sent: true });
    }
    const issued = await issueCode('email_verification_codes', req.user.id, { ttlMs: 15 * 60 * 1000 });
    const delivery = await sendVerificationEmail(req.user.email, req.user.business_name, issued.code);
    return res.json(verificationPayload(issued, delivery.sent, 'email'));
  } catch (err) {
    return next(err);
  }
});

router.post('/resend-email-code', requireAuth, async (req, res, next) => {
  try {
    if (req.user.email_verified) {
      return res.json({ message: 'Email already verified', expires_in: 0, email_sent: true });
    }
    const issued = await issueCode('email_verification_codes', req.user.id, { ttlMs: 15 * 60 * 1000 });
    const delivery = await sendVerificationEmail(req.user.email, req.user.business_name, issued.code);
    return res.json(verificationPayload(issued, delivery.sent, 'email'));
  } catch (err) {
    return next(err);
  }
});

router.post('/verify-email', requireAuth, async (req, res, next) => {
  try {
    if (req.user.email_verified) {
      return res.json({ success: true, user: publicUser(req.user) });
    }
    await consumeCode('email_verification_codes', req.user.id, req.body.code);
    const [user] = await db('users')
      .where({ id: req.user.id })
      .update({
        email_verified: true,
        email_verified_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');
    return res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.post('/change-unverified-email', requireAuth, async (req, res, next) => {
  try {
    if (req.user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    const existing = await db('users').where({ email }).whereNot({ id: req.user.id }).first();
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const [user] = await db('users')
      .where({ id: req.user.id })
      .update({ email, updated_at: db.fn.now() })
      .returning('*');
    const issued = await issueCode('email_verification_codes', user.id, { ttlMs: 15 * 60 * 1000 });
    const delivery = await sendVerificationEmail(user.email, user.business_name, issued.code);
    return res.json({
      user: publicUser(user),
      ...verificationPayload(issued, delivery.sent, 'email'),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/send-phone-verification', requireAuth, async (req, res, next) => {
  try {
    const phone = normalizeKenyaPhone(req.body.phone || req.user.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number' });
    }
    if (phone !== req.user.phone) {
      await db('users').where({ id: req.user.id }).update({
        phone,
        phone_verified: false,
        updated_at: db.fn.now(),
      });
    }
    const issued = await issueCode('phone_verification_codes', req.user.id, {
      ttlMs: 10 * 60 * 1000,
      extra: { delivery_method: 'sms' },
    });
    const delivery = await sendPhoneVerificationSms(phone, issued.code);
    return res.json(verificationPayload(issued, delivery.sent, 'sms'));
  } catch (err) {
    return next(err);
  }
});

router.post('/resend-phone-code', requireAuth, async (req, res, next) => {
  try {
    const issued = await issueCode('phone_verification_codes', req.user.id, {
      ttlMs: 10 * 60 * 1000,
      extra: { delivery_method: 'sms' },
    });
    const delivery = await sendPhoneVerificationSms(req.user.phone, issued.code);
    return res.json(verificationPayload(issued, delivery.sent, 'sms'));
  } catch (err) {
    return next(err);
  }
});

router.post('/verify-phone', requireAuth, async (req, res, next) => {
  try {
    await consumeCode('phone_verification_codes', req.user.id, req.body.code);
    const [user] = await db('users')
      .where({ id: req.user.id })
      .update({
        phone_verified: true,
        phone_verified_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');
    return res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
