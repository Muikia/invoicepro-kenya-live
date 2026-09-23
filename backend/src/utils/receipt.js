const { formatKes } = require('./money');
const { signReceiptToken } = require('./jwt');
const { publicAppUrl } = require('./config');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function receiptUrl(invoiceId) {
  const base = publicAppUrl() || 'http://localhost:5173';
  const token = signReceiptToken(invoiceId);
  return `${base}/receipt/${invoiceId}?token=${encodeURIComponent(token)}`;
}

function receiptHtml({ user, customer, invoice, items }) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}${item.vat_exempt ? ' <small>(VAT exempt)</small>' : ''}</td>
          <td class="num">${escapeHtml(item.quantity)}</td>
          <td class="num">${formatKes(item.unit_price)}</td>
          <td class="num">${formatKes(item.total_kes)}</td>
        </tr>`
    )
    .join('');

  const itemsTotal = items.reduce((sum, item) => sum + Number(item.total_kes), 0);
  const subtotal = Number(invoice.subtotal_kes ?? itemsTotal);
  const vatAmount = Number(invoice.vat_amount_kes || 0);
  const vatRate = Number(invoice.vat_rate || 0);
  const discount = Math.max(0, itemsTotal - subtotal);
  const total = Number(invoice.total_kes_after_vat ?? invoice.total_kes);
  const created = new Date(invoice.created_at).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(invoice.invoice_number)} · ${escapeHtml(user.business_name)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; background: #fff; }
    .sheet { max-width: 720px; margin: 24px auto; padding: 32px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .muted { color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
    th { font-size: 12px; text-transform: uppercase; color: #555; }
    .num { text-align: right; }
    .total { font-size: 20px; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; text-transform: uppercase; }
    .paid { background: #dcfce7; color: #166534; }
    .unpaid { background: #fee2e2; color: #991b1b; }
    .partial { background: #fef9c3; color: #854d0e; }
    @media print { .no-print { display: none; } .sheet { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <button class="no-print" onclick="window.print()">Print</button>
    <h1>${escapeHtml(user.business_name)}</h1>
    <p class="muted">${escapeHtml(user.email)} · ${escapeHtml(user.phone)}</p>
    <h2>${escapeHtml(invoice.invoice_number)}</h2>
    <p>
      Date: ${created}<br />
      Customer: ${escapeHtml(customer.name)} · ${escapeHtml(customer.phone)}<br />
      Status: <span class="badge ${escapeHtml(invoice.payment_status)}">${escapeHtml(invoice.payment_status)}</span>
    </p>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Subtotal: ${formatKes(subtotal)}</p>
    ${discount > 0 ? `<p>Discount: ${formatKes(discount)}</p>` : ''}
    ${vatAmount > 0 ? `<p>VAT (${escapeHtml(vatRate)}%): ${formatKes(vatAmount)}</p>` : ''}
    <p class="total">Total: ${formatKes(total)}</p>
    ${invoice.payment_method ? `<p>Payment method: ${escapeHtml(invoice.payment_method)}</p>` : ''}
    ${invoice.notes ? `<p>Notes: ${escapeHtml(invoice.notes)}</p>` : ''}
    <p class="muted">Thank you for your business.</p>
  </div>
</body>
</html>`;
}

module.exports = {
  receiptHtml,
  receiptUrl,
};
