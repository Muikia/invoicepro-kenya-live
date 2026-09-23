const jwt = require('jsonwebtoken');

function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-only-change-me';
}

function signAuthToken(userId) {
  return jwt.sign({ userId, purpose: 'auth' }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function signResetToken(userId) {
  return jwt.sign({ userId, purpose: 'password-reset' }, secret(), {
    expiresIn: '1h',
  });
}

function signReceiptToken(invoiceId) {
  return jwt.sign({ invoiceId, purpose: 'receipt' }, secret(), {
    expiresIn: '90d',
  });
}

function signDeletionToken(userId, requestId) {
  return jwt.sign({ userId, requestId, purpose: 'deletion' }, secret(), {
    expiresIn: '1h',
  });
}

function verifyToken(token, purpose) {
  const payload = jwt.verify(token, secret());
  if (purpose && payload.purpose !== purpose) {
    const error = new Error('Invalid token');
    error.status = 400;
    throw error;
  }
  return payload;
}

module.exports = {
  signAuthToken,
  signResetToken,
  signReceiptToken,
  signDeletionToken,
  verifyToken,
};
