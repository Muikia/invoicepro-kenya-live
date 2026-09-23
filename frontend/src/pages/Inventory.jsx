import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatKes } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const emptyForm = {
  name: '',
  sku: '',
  unit_price: '',
  quantity_in_stock: 0,
  reorder_level: 10,
  unit_type: 'piece',
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get('/inventory');
    setItems(data.items || []);
    setUpgrade(Boolean(data.upgrade_required));
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err) => {
      toast.error(err.message);
      setLoading(false);
    });
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || '',
      unit_price: item.unit_price,
      quantity_in_stock: item.quantity_in_stock,
      reorder_level: item.reorder_level,
      unit_type: item.unit_type || 'piece',
    });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        unit_price: Number(form.unit_price),
        quantity_in_stock: Number(form.quantity_in_stock),
        reorder_level: Number(form.reorder_level),
      };
      if (editing) {
        await api.put(`/inventory/${editing.id}`, payload);
        toast.success('Item updated');
      } else {
        await api.post('/inventory', payload);
        toast.success('Item added');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast.success('Item deleted');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (upgrade) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">
          Inventory tracking is on Basic and Pro. Track stock, get low-stock alerts, and pull items onto invoices.
        </p>
        <Button asChild>
          <Link to="/app/upgrade">Upgrade Now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Button onClick={startCreate}>Add Item</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading inventory...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No items yet. Add shoe polish, screens, fabric — whatever you sell.</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.name}
                    <span className="block text-xs text-muted-foreground">{item.unit_type}</span>
                  </TableCell>
                  <TableCell>{item.sku || '—'}</TableCell>
                  <TableCell>{formatKes(item.unit_price)}</TableCell>
                  <TableCell>{item.quantity_in_stock}</TableCell>
                  <TableCell>{item.reorder_level}</TableCell>
                  <TableCell>
                    <Badge variant={item.low_stock ? 'unpaid' : 'paid'}>
                      {item.low_stock ? 'Low' : 'In stock'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(item)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit item' : 'Add item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-2">
              <Label>Item name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit type</Label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                >
                  <option value="piece">piece</option>
                  <option value="bottle">bottle</option>
                  <option value="meter">meter</option>
                  <option value="kg">kg</option>
                  <option value="litre">litre</option>
                  <option value="pair">pair</option>
                  <option value="box">box</option>
                  <option value="service">service</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Unit price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity_in_stock}
                  onChange={(e) => setForm({ ...form, quantity_in_stock: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder level</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
