function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function formatKes(value) {
  return `KSh ${toNumber(value).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function nextInvoiceNumber(count) {
  return `INV-${String(count).padStart(3, '0')}`;
}

module.exports = {
  toNumber,
  money,
  formatKes,
  nextInvoiceNumber,
};
