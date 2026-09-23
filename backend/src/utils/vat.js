const { money, toNumber } = require('./money');

const DEFAULT_VAT_RATE = 16;

function computeInvoiceTotals(items, { discountType, discountValue, vatRate, vatEnabled }) {
  const itemsTotal = money(items.reduce((sum, item) => sum + toNumber(item.total_kes), 0));
  let discount = 0;

  const type = String(discountType || '').trim();
  const value = toNumber(discountValue);
  if (type && value > 0) {
    if (type === 'percent') {
      if (value > 100) {
        const error = new Error('Discount percent cannot be more than 100');
        error.status = 400;
        throw error;
      }
      discount = money((itemsTotal * value) / 100);
    } else if (type === 'fixed') {
      if (value > itemsTotal) {
        const error = new Error('Discount cannot be more than the invoice total');
        error.status = 400;
        throw error;
      }
      discount = money(value);
    } else {
      const error = new Error('Discount must be percent or fixed');
      error.status = 400;
      throw error;
    }
  }

  const subtotal = money(Math.max(0, itemsTotal - discount));
  const rate = Number.isFinite(Number(vatRate)) ? Number(vatRate) : DEFAULT_VAT_RATE;

  if (!vatEnabled || rate <= 0 || itemsTotal <= 0) {
    return {
      items_total: itemsTotal,
      discount,
      subtotal_kes: subtotal,
      vat_rate: vatEnabled ? rate : 0,
      vat_amount_kes: 0,
      total_kes: subtotal,
      total_kes_after_vat: subtotal,
    };
  }

  const taxableItems = money(
    items.reduce((sum, item) => (item.vat_exempt ? sum : sum + toNumber(item.total_kes)), 0)
  );
  const taxableRatio = taxableItems / itemsTotal;
  const vat_amount_kes = money((subtotal * taxableRatio * rate) / 100);
  const total = money(subtotal + vat_amount_kes);

  return {
    items_total: itemsTotal,
    discount,
    subtotal_kes: subtotal,
    vat_rate: rate,
    vat_amount_kes,
    total_kes: total,
    total_kes_after_vat: total,
  };
}

module.exports = {
  DEFAULT_VAT_RATE,
  computeInvoiceTotals,
};
