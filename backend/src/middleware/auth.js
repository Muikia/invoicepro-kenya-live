const db = require('../db');
const { verifyToken } = require('../utils/jwt');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Login required' });
    }

    let payload;
    try {
      payload = verifyToken(token, 'auth');
    } catch (err) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    const user = await db('users').where({ id: payload.userId }).first();
    if (!user || user.deleted_at) {
      return res.status(401).json({ error: 'Account not found' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    business_name: user.business_name,
    business_type: user.business_type,
    subscription_tier: user.subscription_tier,
    subscription_date: user.subscription_date,
    m_pesa_number: user.m_pesa_number,
    profile_picture_url: user.profile_picture_url,
    email_verified: Boolean(user.email_verified),
    email_verified_at: user.email_verified_at || null,
    phone_verified: Boolean(user.phone_verified),
    phone_verified_at: user.phone_verified_at || null,
    preferred_verification_method: user.preferred_verification_method || 'sms',
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function requireEmailVerified(req, res, next) {
  return next();
}

module.exports = {
  requireAuth,
  requireEmailVerified,
  publicUser,
};
