const PDFDocument = require('pdfkit');
const { formatKes } = require('./money');

function receiptPdfBuffer({ user, customer, invoice, items }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const created = new Date(invoice.created_at).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const itemsTotal = items.reduce((sum, item) => sum + Number(item.total_kes), 0);
    const subtotal = Number(invoice.subtotal_kes ?? itemsTotal);
    const vatAmount = Number(invoice.vat_amount_kes || 0);
    const vatRate = Number(invoice.vat_rate || 0);
    const total = Number(invoice.total_kes_after_vat ?? invoice.total_kes);

    doc.fontSize(20).text(user.business_name || 'InvoicePro');
    doc.fontSize(10).fillColor('#444').text(`${user.email || ''}  ·  ${user.phone || ''}`);
    if (user.m_pesa_number) {
      doc.text(`M-Pesa: ${user.m_pesa_number}`);
    }
    doc.moveDown();
    doc.fillColor('#111').fontSize(16).text(invoice.invoice_number);
    doc.fontSize(10).fillColor('#444');
    doc.text(`Date: ${created}`);
    doc.text(`Customer: ${customer.name}  ·  ${customer.phone || ''}`);
    if (customer.email) doc.text(`Email: ${customer.email}`);
    doc.text(`Status: ${invoice.payment_status || 'unpaid'}`);
    if (invoice.payment_method) doc.text(`Payment: ${invoice.payment_method}`);
    doc.moveDown();

    const tableTop = doc.y;
    doc.fillColor('#111').fontSize(10);
    doc.text('Description', 48, tableTop, { width: 240 });
    doc.text('Qty', 300, tableTop, { width: 50, align: 'right' });
    doc.text('Unit', 360, tableTop, { width: 80, align: 'right' });
    doc.text('Total', 450, tableTop, { width: 90, align: 'right' });
    doc.moveTo(48, tableTop + 16).lineTo(547, tableTop + 16).strokeColor('#ddd').stroke();

    let y = tableTop + 24;
    items.forEach((item) => {
      const label = item.vat_exempt ? `${item.description} (VAT exempt)` : item.description;
      doc.fillColor('#111').text(label, 48, y, { width: 240 });
      doc.text(String(item.quantity), 300, y, { width: 50, align: 'right' });
      doc.text(formatKes(item.unit_price), 360, y, { width: 80, align: 'right' });
      doc.text(formatKes(item.total_kes), 450, y, { width: 90, align: 'right' });
      y += 18;
    });

    y += 12;
    doc.text(`Subtotal: ${formatKes(subtotal)}`, 300, y, { width: 247, align: 'right' });
    y += 16;
    if (vatAmount > 0) {
      doc.text(`VAT (${vatRate}%): ${formatKes(vatAmount)}`, 300, y, { width: 247, align: 'right' });
      y += 16;
    }
    doc.fontSize(14).text(`Total: ${formatKes(total)}`, 300, y, { width: 247, align: 'right' });
    y += 28;
    if (invoice.notes) {
      doc.fontSize(10).fillColor('#444').text(`Notes: ${invoice.notes}`, 48, y, { width: 499 });
      y += 24;
    }
    doc.fontSize(10).fillColor('#444').text('Thank you for your business!', 48, y);

    doc.end();
  });
}

module.exports = {
  receiptPdfBuffer,
};
