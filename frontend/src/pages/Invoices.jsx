import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatDate, formatKes } from '@/lib/format';
import { whatsappLink } from '@/lib/utils';
import { computeInvoiceTotals, hasFeature } from '@/lib/vat';
import { useAuth } from '@/context/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { openReceipt } from '@/lib/receipt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const emptyItem = { description: '', quantity: 1, unit_price: '', vat_exempt: false, inventory_item_id: '' };

export default function Invoices() {
  const navigate = useNavigate();
  const { usage, setUsage } = useOutletContext();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [created, setCreated] = useState(null);

  async function load() {
    const params = {};
    if (status !== 'all') params.status = status;
    if (range === 'week' || range === 'month') params.range = range;
    if (range === 'custom') {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    const { data } = await api.get('/invoices', { params });
    setInvoices(data.invoices);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, [status, range, from, to]);

  function startCreate() {
    if (usage && !usage.can_create_invoice) {
      setUpgradeOpen(true);
      return;
    }
    setCreateOpen(true);
  }

  async function remove(id) {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button onClick={startCreate}>Create Invoice</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="h-10 rounded-md border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
        </select>
        <select className="h-10 rounded-md border px-3 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="month">This Month</option>
          <option value="week">This Week</option>
          <option value="all">All time</option>
          <option value="custom">Custom</option>
        </select>
        {range === 'custom' && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading invoices...</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {invoice.invoice_number}{' '}
                    {invoice.is_repeat_customer && <Badge variant="secondary">Repeat</Badge>}
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>{formatKes(invoice.total_kes)}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.payment_status}>{invoice.payment_status}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(invoice.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/app/invoices/${invoice.id}`}>View Details</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReceipt(invoice.id)}
                      >
                        Print
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
                          const body = encodeURIComponent(
                            `Please view your invoice: ${invoice.receipt_url || `${window.location.origin}/receipt/${invoice.id}`}`
                          );
                          window.location.href = `mailto:?subject=${subject}&body=${body}`;
                        }}
                      >
                        Email
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(invoice.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (payload) => {
          setCreated(payload);
          setCreateOpen(false);
          await load();
          const statusRes = await api.get('/subscription/status');
          setUsage(statusRes.data);
        }}
        onUpgrade={() => {
          setCreateOpen(false);
          setUpgradeOpen(true);
        }}
      />

      <Dialog open={Boolean(created)} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent>
          {created && (
            <>
              <DialogHeader>
                <DialogTitle>Invoice {created.invoice.invoice_number} created</DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => openReceipt(created.invoice.id, created.invoice.receipt_url)}>
                  Print
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = created.invoice.receipt_url || `${window.location.origin}/receipt/${created.invoice.id}`;
                    window.location.href = `mailto:?subject=${encodeURIComponent(created.invoice.invoice_number)}&body=${encodeURIComponent(url)}`;
                  }}
                >
                  Email
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={whatsappLink(
                      created.invoice.customer_phone,
                      `Invoice ${created.invoice.invoice_number} for ${formatKes(created.invoice.total_kes)}. View: ${created.invoice.receipt_url}`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/app/invoices/${created.invoice.id}`)}>
                  View invoice
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Basic (KSh 500/month) for unlimited</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">You have used your 10 free invoices this month.</p>
          <Button onClick={() => navigate('/app/upgrade')}>Upgrade Now</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateInvoiceDialog({ open, onOpenChange, onCreated, onUpgrade }) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [addCustomer, setAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', is_repeat_customer: false });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [nextNumber, setNextNumber] = useState('INV-001');
  const [inventory, setInventory] = useState([]);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState(16);
  const { user } = useAuth();
  const canVat = hasFeature(user?.subscription_tier, 'vat');
  const canInventory = hasFeature(user?.subscription_tier, 'inventory');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSearch('');
    setSelected(null);
    setAddCustomer(false);
    setNewCustomer({ name: '', phone: '', is_repeat_customer: false });
    setItems([{ ...emptyItem }]);
    setDiscountType('');
    setDiscountValue('');
    setNotes('');
    setPaymentMethod('cash');
    setVatEnabled(false);
    setVatRate(16);
    if (canInventory) {
      api.get('/inventory').then((res) => setInventory(res.data.items || [])).catch(() => setInventory([]));
    }
    if (canVat) {
      api.get('/vat/settings').then((res) => {
        const settings = res.data.settings || {};
        setVatRate(Number(settings.default_vat_rate || 16));
        setVatEnabled(Boolean(settings.business_vat_registered));
      }).catch(() => {});
    }
    api.get('/subscription/status').then((res) => {
      const usedAllTimeHint = res.data.invoices_used || 0;
      setNextNumber(`INV-${String(usedAllTimeHint + 1).padStart(3, '0')}`);
    }).catch(() => {});
    api.get('/invoices').then((res) => {
      const last = res.data.invoices?.[0]?.invoice_number;
      const n = last ? Number(String(last).replace('INV-', '')) + 1 : 1;
      if (Number.isFinite(n)) setNextNumber(`INV-${String(n).padStart(3, '0')}`);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get('/customers', { params: search ? { search } : {} }).then((res) => setCustomers(res.data.customers));
    }, 200);
    return () => clearTimeout(t);
  }, [search, open]);

  const totals = useMemo(
    () => computeInvoiceTotals(items, { discountType, discountValue, vatRate, vatEnabled: canVat && vatEnabled }),
    [items, discountType, discountValue, vatRate, vatEnabled, canVat]
  );
  const itemsTotal = totals.itemsTotal;
  const discount = totals.discount;
  const total = totals.total;

  async function createCustomer(e) {
    e.preventDefault();
    try {
      const { data } = await api.post('/customers', newCustomer);
      setSelected(data.customer);
      setAddCustomer(false);
      toast.success('Customer added');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function save(printAfter) {
    setSaving(true);
    try {
      const oversold = items.find((item) => {
        if (!item.inventory_item_id) return false;
        const stock = inventory.find((row) => row.id === item.inventory_item_id);
        return stock && Number(item.quantity) > Number(stock.quantity_in_stock);
      });
      if (oversold) {
        const stock = inventory.find((row) => row.id === oversold.inventory_item_id);
        const ok = window.confirm(
          `Only ${stock.quantity_in_stock} left, selling ${oversold.quantity}. Continue?`
        );
        if (!ok) {
          setSaving(false);
          return;
        }
      }

      const { data } = await api.post('/invoices', {
        customer_id: selected.id,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          vat_exempt: Boolean(item.vat_exempt),
          inventory_item_id: item.inventory_item_id || undefined,
        })),
        discount_type: discountType || undefined,
        discount_value: discountValue ? Number(discountValue) : undefined,
        notes,
        payment_method: paymentMethod,
        vat_rate: canVat && vatEnabled ? Number(vatRate) : 0,
        apply_vat: canVat && vatEnabled,
      });
      toast.success(`Invoice ${data.invoice.invoice_number} created`);
      onCreated(data);
      if (printAfter) {
        await openReceipt(data.invoice.id, data.invoice.receipt_url);
      }
    } catch (err) {
      if (err.code === 'UPGRADE_REQUIRED') {
        onUpgrade();
      } else {
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Invoice · Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <Label>Search customer</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" />
            <div className="max-h-48 overflow-auto border rounded-md">
              {customers.slice(0, 8).map((customer) => (
                <button
                  type="button"
                  key={customer.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selected?.id === customer.id ? 'bg-muted' : ''}`}
                  onClick={() => setSelected(customer)}
                >
                  {customer.name} · {customer.phone}
                  {customer.is_repeat_customer || customer.is_repeat ? (
                    <span className="block text-xs text-emerald-700">
                      🔄 Repeat Customer ({customer.visit_count} visits, {formatKes(customer.total_spent_kes)} total)
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {selected && (
              <p className="text-sm">
                {selected.is_repeat_customer || selected.is_repeat ? '🔄 Repeat Customer · ' : ''}
                This customer has {selected.visit_count} previous invoice{selected.visit_count === 1 ? '' : 's'}, {formatKes(selected.total_spent_kes)} total
              </p>
            )}
            <Button variant="link" className="px-0" onClick={() => setAddCustomer((v) => !v)}>
              Add New Customer
            </Button>
            {addCustomer && (
              <form onSubmit={createCustomer} className="grid sm:grid-cols-2 gap-2">
                <Input placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} required />
                <Input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} required />
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(newCustomer.is_repeat_customer)}
                    onCheckedChange={(v) => setNewCustomer({ ...newCustomer, is_repeat_customer: Boolean(v) })}
                  />
                  Is this a repeat customer?
                </label>
                {newCustomer.is_repeat_customer && (
                  <p className="sm:col-span-2 text-sm text-emerald-700">🔄 Will be saved as Repeat Customer · Last visit Today</p>
                )}
                <Button type="submit">Save customer</Button>
              </form>
            )}
            <Button disabled={!selected} onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-md border p-2">
                {canInventory && inventory.length > 0 && (
                  <select
                    className="h-10 w-full rounded-md border px-3 text-sm"
                    value={item.inventory_item_id || ''}
                    onChange={(e) => {
                      const next = [...items];
                      const chosen = inventory.find((row) => row.id === e.target.value);
                      if (!chosen) {
                        next[index] = { ...next[index], inventory_item_id: '' };
                      } else {
                        next[index] = {
                          ...next[index],
                          inventory_item_id: chosen.id,
                          description: chosen.name,
                          unit_price: chosen.unit_price,
                        };
                      }
                      setItems(next);
                    }}
                  >
                    <option value="">Custom item</option>
                    {inventory.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {formatKes(row.unit_price)} · {row.quantity_in_stock} in stock
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-12 gap-2">
                  <Input
                    className="col-span-12 sm:col-span-5"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => {
                      const next = [...items];
                      next[index].description = e.target.value;
                      next[index].inventory_item_id = '';
                      setItems(next);
                    }}
                  />
                  <Input
                    className="col-span-4 sm:col-span-2"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[index].quantity = e.target.value;
                      setItems(next);
                    }}
                  />
                  <Input
                    className="col-span-5 sm:col-span-3"
                    type="number"
                    min="0"
                    placeholder="Unit price"
                    value={item.unit_price}
                    onChange={(e) => {
                      const next = [...items];
                      next[index].unit_price = e.target.value;
                      setItems(next);
                    }}
                  />
                  <div className="col-span-3 sm:col-span-2 text-sm self-center">{formatKes(Number(item.quantity || 0) * Number(item.unit_price || 0))}</div>
                </div>
                {canVat && vatEnabled && (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={Boolean(item.vat_exempt)}
                      onCheckedChange={(v) => {
                        const next = [...items];
                        next[index].vat_exempt = Boolean(v);
                        setItems(next);
                      }}
                    />
                    VAT Exempt?
                  </label>
                )}
                {item.inventory_item_id && Number(item.quantity) > Number(inventory.find((row) => row.id === item.inventory_item_id)?.quantity_in_stock || 0) && (
                  <p className="text-xs text-amber-700">
                    Only {inventory.find((row) => row.id === item.inventory_item_id)?.quantity_in_stock || 0} left
                  </p>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={() => setItems([...items, { ...emptyItem }])}>
              + Add another item
            </Button>
            <div className="grid sm:grid-cols-2 gap-2">
              <select className="h-10 rounded-md border px-3 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="">No discount</option>
                <option value="percent">Discount %</option>
                <option value="fixed">Discount fixed (KSh)</option>
              </select>
              <Input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} disabled={!discountType} />
            </div>
            {canVat && (
              <div className="space-y-2 rounded-md bg-muted p-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={vatEnabled} onCheckedChange={(v) => setVatEnabled(Boolean(v))} />
                  Apply VAT
                </label>
                {vatEnabled && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>VAT rate</span>
                    <Input
                      className="w-24"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                    />
                    <span>%</span>
                  </div>
                )}
              </div>
            )}
            <div className="text-sm space-y-1">
              <p>Subtotal: {formatKes(totals.subtotal)}</p>
              {discount > 0 && <p>Discount: {formatKes(discount)}</p>}
              {canVat && vatEnabled && (
                <p>
                  VAT ({totals.vatRate}%): {formatKes(totals.vat)}
                </p>
              )}
              <p className="text-lg font-semibold">Total: {formatKes(total)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={items.every((i) => !i.description)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p>Invoice number: <strong>{nextNumber}</strong></p>
            <p>Customer: {selected?.name}</p>
            <ul className="text-sm">
              {items.filter((i) => i.description).map((item, i) => (
                <li key={i}>
                  {item.description} × {item.quantity} = {formatKes(Number(item.quantity) * Number(item.unit_price || 0))}
                </li>
              ))}
            </ul>
            <p className="text-2xl font-bold">{formatKes(total)}</p>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button disabled={saving} onClick={() => save(false)}>
                {saving ? 'Saving...' : 'Save Invoice'}
              </Button>
              <Button disabled={saving} variant="secondary" onClick={() => save(true)}>
                Save & Print
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
