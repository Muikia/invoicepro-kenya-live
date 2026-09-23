import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatDate, formatKes, formatRelative } from '@/lib/format';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const emptyForm = { name: '', phone: '', email: '', notes: '', is_repeat_customer: false };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  async function load(query = search, nextFilter = filter) {
    const params = {};
    if (query) params.search = query;
    if (nextFilter === 'repeat' || nextFilter === 'new') params.filter = nextFilter;
    const { data } = await api.get('/customers', { params });
    setCustomers(data.customers);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load(search, filter).catch((err) => toast.error(err.message));
    }, 250);
    return () => clearTimeout(t);
  }, [search, filter]);

  async function saveCustomer(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editOpen && detail?.customer) {
        await api.put(`/customers/${detail.customer.id}`, form);
        toast.success('Customer updated');
        setEditOpen(false);
      } else {
        await api.post('/customers', form);
        toast.success('Customer added');
        setAddOpen(false);
      }
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id) {
    try {
      const { data } = await api.get(`/customers/${id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleRepeat(customer, nextValue) {
    try {
      const { data } = await api.put(`/customers/${customer.id}/mark-repeat`, {
        is_repeat_customer: nextValue,
      });
      setCustomers((rows) => rows.map((row) => (row.id === data.customer.id ? { ...row, ...data.customer } : row)));
      if (detail?.customer?.id === data.customer.id) {
        setDetail({ ...detail, customer: { ...detail.customer, ...data.customer } });
      }
      toast.success(data.customer.is_repeat_customer ? 'Marked as repeat customer' : 'Unmarked as repeat');
      return data.customer;
    } catch (err) {
      toast.error(err.message);
      return customer;
    }
  }

  async function saveNotes() {
    try {
      await api.put(`/customers/${detail.customer.id}`, { notes: detail.customer.notes });
      toast.success('Notes saved');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this customer and their invoices?')) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setAddOpen(true);
          }}
        >
          Add Customer
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="h-10 rounded-md border px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Customers</option>
          <option value="repeat">Repeat Customers Only</option>
          <option value="new">New Customers Only</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading customers...</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className={`cursor-pointer ${customer.is_repeat_customer ? 'bg-emerald-50/70' : ''}`}
                  onClick={() => openDetail(customer.id)}
                >
                  <TableCell>
                    {customer.is_repeat_customer ? '🔄 ' : ''}
                    {customer.name}{' '}
                    {customer.is_repeat_customer && <Badge variant="secondary">Repeat Customer</Badge>}
                  </TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{formatKes(customer.total_spent_kes)}</TableCell>
                  <TableCell>{customer.visit_count}</TableCell>
                  <TableCell>{formatRelative(customer.last_visit_date)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDetail(customer.id)}>
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setForm({
                            name: customer.name,
                            phone: customer.phone,
                            email: customer.email || '',
                            notes: customer.notes || '',
                            is_repeat_customer: Boolean(customer.is_repeat_customer),
                          });
                          setDetail({ customer, invoices: [] });
                          setEditOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(customer.id)}>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            form={form}
            setForm={setForm}
            onSubmit={saveCustomer}
            saving={saving}
            onRepeatChange={(checked) => setForm({ ...form, is_repeat_customer: checked })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            form={form}
            setForm={setForm}
            onSubmit={saveCustomer}
            saving={saving}
            onRepeatChange={async (checked) => {
              setForm({ ...form, is_repeat_customer: checked });
              if (detail?.customer?.id) {
                const updated = await toggleRepeat(detail.customer, checked);
                setForm((current) => ({ ...current, is_repeat_customer: Boolean(updated.is_repeat_customer) }));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail) && !editOpen} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.customer.name}
                  {detail.customer.is_repeat_customer && <Badge variant="secondary">🔄 Repeat Customer</Badge>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>Phone: {detail.customer.phone}</p>
                {detail.customer.email && <p>Email: {detail.customer.email}</p>}
                <div className={`rounded-md p-3 ${detail.customer.is_repeat_customer ? 'bg-emerald-50' : 'bg-muted'}`}>
                  <p className="font-medium mb-1">Stats</p>
                  <p>Visits: {detail.customer.visit_count}</p>
                  <p>Total Spent: {formatKes(detail.customer.total_spent_kes)}</p>
                  <p>Last Visit: {formatRelative(detail.customer.last_visit_date)}</p>
                  <p>First Visit: {formatRelative(detail.customer.created_at)}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={Boolean(detail.customer.is_repeat_customer)}
                    onCheckedChange={(v) => toggleRepeat(detail.customer, Boolean(v))}
                  />
                  Is this a repeat customer?
                </label>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={detail.customer.notes || ''}
                    onChange={(e) =>
                      setDetail({ ...detail, customer: { ...detail.customer, notes: e.target.value } })
                    }
                  />
                  <Button size="sm" onClick={saveNotes}>
                    Save notes
                  </Button>
                </div>
                <div>
                  <p className="font-medium mb-2">Invoice History ({(detail.invoices || []).length} total)</p>
                  <ul className="space-y-1">
                    {(detail.invoices || []).map((invoice) => (
                      <li key={invoice.id}>
                        <Link className="underline" to={`/app/invoices/${invoice.id}`}>
                          {invoice.invoice_number}
                        </Link>{' '}
                        · {formatKes(invoice.total_kes)} · {invoice.payment_status} · {formatDate(invoice.created_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerForm({ form, setForm, onSubmit, saving, onRepeatChange }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label>Email (optional)</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={Boolean(form.is_repeat_customer)}
          onCheckedChange={(v) => (onRepeatChange || ((checked) => setForm({ ...form, is_repeat_customer: checked })))(Boolean(v))}
        />
        Is this a repeat customer?
      </label>
      {form.is_repeat_customer && (
        <p className="text-sm text-emerald-700">🔄 Repeat Customer · Last visit set to Today</p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
