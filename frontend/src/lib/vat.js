export const DEFAULT_VAT_RATE = 16;

export function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function computeInvoiceTotals(items, { discountType, discountValue, vatRate, vatEnabled }) {
  const itemsTotal = money(
    items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  );
  const value = Number(discountValue || 0);
  let discount = 0;
  if (discountType && value > 0) {
    discount = discountType === 'percent' ? money((itemsTotal * value) / 100) : money(value);
  }
  const subtotal = money(Math.max(0, itemsTotal - discount));
  const rate = Number(vatRate);
  if (!vatEnabled || !Number.isFinite(rate) || rate <= 0 || itemsTotal <= 0) {
    return { itemsTotal, discount, subtotal, vat: 0, vatRate: vatEnabled ? rate || 0 : 0, total: subtotal };
  }
  const taxable = money(
    items.reduce(
      (sum, item) =>
        item.vat_exempt ? sum : sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    )
  );
  const vat = money((subtotal * (taxable / itemsTotal) * rate) / 100);
  return { itemsTotal, discount, subtotal, vat, vatRate: rate, total: money(subtotal + vat) };
}

export function isPaidTier(tier) {
  return Boolean(tier && tier !== 'free');
}

export function hasFeature(tier, feature) {
  const paid = isPaidTier(tier);
  if (['vat', 'inventory', 'receipts_share', 'top_products'].includes(feature)) return paid;
  return tier === 'pro';
}
