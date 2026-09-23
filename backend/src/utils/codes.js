const crypto = require('crypto');
const db = require('../db');

function sixDigit() {
  return String(crypto.randomInt(100000, 1000000));
}

async function countRecentCodes(table, userId, hours = 1) {
  const row = await db(table)
    .where({ user_id: userId })
    .andWhere('created_at', '>=', new Date(Date.now() - hours * 60 * 60 * 1000))
    .count('* as count')
    .first();
  return Number(row.count || 0);
}

async function issueCode(table, userId, { ttlMs, extra = {}, maxPerHour = 3 }) {
  const recent = await countRecentCodes(table, userId, 1);
  if (recent >= maxPerHour) {
    const error = new Error('Too many codes sent. Try again in an hour.');
    error.status = 429;
    throw error;
  }

  const code = sixDigit();
  const expires_at = new Date(Date.now() + ttlMs);
  await db(table).insert({
    user_id: userId,
    code,
    expires_at,
    used: false,
    ...extra,
  });
  return { code, expires_at, expires_in: Math.round(ttlMs / 1000) };
}

async function consumeCode(table, userId, rawCode) {
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) {
    const error = new Error('Invalid code. Try again.');
    error.status = 400;
    throw error;
  }

  const row = await db(table)
    .where({ user_id: userId, code, used: false })
    .orderBy('created_at', 'desc')
    .first();

  if (!row) {
    const error = new Error('Invalid code. Try again.');
    error.status = 400;
    throw error;
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    const error = new Error('Code expired. Request new code.');
    error.status = 400;
    throw error;
  }

  await db(table).where({ id: row.id }).update({
    used: true,
    used_at: db.fn.now(),
  });

  return row;
}

module.exports = {
  sixDigit,
  issueCode,
  consumeCode,
  countRecentCodes,
};
