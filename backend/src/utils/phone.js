function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeKenyaPhone(phone) {
  const raw = String(phone || '').trim();
  const digits = digitsOnly(raw);

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return `+254${digits}`;
  }
  if (raw.startsWith('+254') && digits.length === 12) {
    return `+${digits}`;
  }

  return null;
}

function isValidKenyaPhone(phone) {
  return Boolean(normalizeKenyaPhone(phone));
}

function whatsappNumber(phone) {
  const normalized = normalizeKenyaPhone(phone);
  return normalized ? normalized.replace('+', '') : '';
}

module.exports = {
  normalizeKenyaPhone,
  isValidKenyaPhone,
  whatsappNumber,
};
