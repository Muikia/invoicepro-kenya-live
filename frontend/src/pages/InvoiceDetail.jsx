import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatDate, formatKes } from '@/lib/format';
import { whatsappLink } from '@/lib/utils';
import { hasFeature } from '@/lib/vat';
import { openReceipt } from '@/lib/receipt';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waData, setWaData] = useState(null);
  const canShare = hasFeature(user?.subscription_tier, 'receipts_share');

  async function load() {
    const { data } = await api.get(`/invoices/${id}`);
    setInvoice(data.invoice);
    setItems(data.items);
    setEmailTo(data.invoice.customer_email || '');
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      toast.error(err.message);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="text-muted-foreground">Loading invoice...</p>;
  if (!invoice) return <p>Invoice not found.</p>;

  const itemsTotal = items.reduce((sum, item) => sum + Number(item.total_kes), 0);
  const subtotal = Number(invoice.subtotal_kes ?? itemsTotal);
  const vatAmount = Number(invoice.vat_amount_kes || 0);
  const vatRate = Number(invoice.vat_rate || 0);
  const discount = Math.max(0, itemsTotal - subtotal);
  const receiptLink = invoice.share_url || invoice.receipt_url || `${window.location.origin}/receipt/${invoice.id}`;

  async function markPaid() {
    try {
      await api.put(`/invoices/${invoice.id}/mark-paid`, { payment_method: invoice.payment_method || 'cash' });
      toast.success('Marked as paid');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${invoice.id}`);
      toast.success('Invoice deleted');
      navigate('/app/invoices');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
          <p className="text-muted-foreground">
            {formatDate(invoice.created_at)} · {invoice.customer_name}
            {invoice.is_repeat_customer && (
              <Badge variant="secondary" className="ml-2">
                Repeat
              </Badge>
            )}
          </p>
        </div>
        <Badge variant={invoice.payment_status}>{invoice.payment_status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.description}
                    {item.vat_exempt ? <span className="ml-2 text-xs text-muted-foreground">VAT exempt</span> : null}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatKes(item.unit_price)}</TableCell>
                  <TableCell>{formatKes(item.total_kes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 space-y-1 text-right">
            <p>Subtotal: {formatKes(subtotal)}</p>
            {discount > 0 && <p>Discount: {formatKes(discount)}</p>}
            {vatAmount > 0 && (
              <p>
                VAT ({vatRate}%): {formatKes(vatAmount)}
              </p>
            )}
            <p className="text-2xl font-bold">Total: {formatKes(invoice.total_kes)}</p>
          </div>
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>{invoice.notes}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {invoice.payment_status !== 'paid' && <Button onClick={markPaid}>Mark as Paid</Button>}
        <Button variant="outline" onClick={() => openReceipt(invoice.id, receiptLink)}>
          Print Receipt
        </Button>
        <Button variant="outline" onClick={() => downloadPdf()}>
          Download PDF
        </Button>
        <Button variant="outline" onClick={() => (canShare ? setEmailOpen(true) : navigate('/app/upgrade'))}>
          Email Receipt
        </Button>
        <Button variant="outline" onClick={() => openWhatsApp()}>
          WhatsApp Receipt
        </Button>
        <Button variant="outline" onClick={() => copyLink()}>
          Copy WhatsApp Link
        </Button>
        <Button variant="destructive" onClick={remove}>
          Delete
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/app/invoices">Back</Link>
        </Button>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Send to</Label>
              <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@email.com" />
            </div>
            <Button disabled={emailSending} onClick={sendEmail}>
              {emailSending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp receipt</DialogTitle>
          </DialogHeader>
          {waData && (
            <div className="space-y-3 text-sm">
              <img
                alt="Receipt QR"
                className="mx-auto h-40 w-40"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(waData.shareLink)}`}
              />
              <p className="break-all text-muted-foreground">{waData.shareLink}</p>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{waData.message}</pre>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={whatsappLink(invoice.customer_phone, waData.message)} target="_blank" rel="noreferrer">
                    Open WhatsApp
                  </a>
                </Button>
                <Button variant="outline" onClick={() => copyText(waData.message, 'Message copied')}>
                  Copy message
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  async function sendEmail() {
    if (!emailTo) {
      toast.error('Enter a customer email');
      return;
    }
    setEmailSending(true);
    try {
      await api.post(`/invoices/${invoice.id}/send-email`, { to_email: emailTo });
      toast.success(`Receipt sent to ${emailTo}`);
      setEmailOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEmailSending(false);
    }
  }

  async function openWhatsApp() {
    if (!canShare) {
      navigate('/app/upgrade');
      return;
    }
    try {
      const { data } = await api.post(`/invoices/${invoice.id}/whatsapp-link`, {
        customer_phone: invoice.customer_phone,
      });
      setWaData(data);
      setWaOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function copyLink() {
    if (!canShare) {
      navigate('/app/upgrade');
      return;
    }
    try {
      const { data } = await api.post(`/invoices/${invoice.id}/whatsapp-link`, {
        customer_phone: invoice.customer_phone,
      });
      await copyText(data.shareLink, 'WhatsApp link copied');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function downloadPdf() {
    try {
      const response = await api.get(`/invoices/${invoice.id}/receipt-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Could not download PDF');
    }
  }

  async function copyText(value, success) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error('Could not copy');
    }
  }
}
