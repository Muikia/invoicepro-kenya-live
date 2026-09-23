import api from '@/lib/api';

export async function openReceipt(invoiceId, receiptUrl) {
  if (receiptUrl) {
    window.open(receiptUrl, '_blank');
    return;
  }

  const { data } = await api.get(`/invoices/${invoiceId}/receipt`, { responseType: 'text' });
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.document.write(data);
  popup.document.close();
}
