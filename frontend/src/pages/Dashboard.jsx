import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, FileText, Repeat, TrendingUp, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatKes } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Dashboard() {
  const { user } = useAuth();
  const { usage } = useOutletContext();
  const [data, setData] = useState(null);
  const [chart, setChart] = useState([]);
  const [lowStock, setLowStock] = useState({ items: [], count: 0 });
  const [vatMonth, setVatMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/revenue'),
      api.get('/inventory/low-stock').catch(() => ({ data: { items: [], count: 0 } })),
      api.get('/vat/report').catch(() => ({ data: { total_vat_collected: 0 } })),
    ])
      .then(([dash, revenue, stock, vat]) => {
        setData(dash.data);
        setChart(
          (revenue.data.days || []).map((d) => ({
            day: String(d.day).slice(5, 10),
            revenue: Number(d.revenue),
          }))
        );
        setLowStock({ items: stock.data.items || [], count: stock.data.count || 0 });
        setVatMonth(Number(vat.data.total_vat_collected || 0));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading dashboard...</p>;

  const used = usage?.invoices_used ?? data?.invoices_this_month ?? 0;
  const limit = usage?.invoices_limit;
  const tier = (usage?.subscription_tier || user.subscription_tier || 'free').toUpperCase();

  return (
    <div className="space-y-6">
      {!user.phone_verified && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Phone not verified. Add SMS verification for extra account security.</span>
          <Button size="sm" variant="outline" asChild>
            <Link to="/verify-phone">Complete phone verification</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user.business_name}</h1>
          <p className="text-sm text-muted-foreground">
            {tier}
            {limit ? ` (${used}/${limit} invoices used)` : ' · unlimited invoices'}
          </p>
        </div>
        {(!usage || usage.subscription_tier === 'free') && (
          <Button asChild>
            <Link to="/app/upgrade">Upgrade to Basic · KSh 500/month</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={TrendingUp} label="Monthly Revenue" value={formatKes(data.monthly_revenue)} />
        <Stat icon={FileText} label="Invoices This Month" value={data.invoices_this_month} />
        <Stat icon={Users} label="Total Customers" value={data.total_customers} />
        <Stat icon={Repeat} label="Repeat Customer Rate" value={`${data.repeat_customer_rate}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>VAT This Month: {formatKes(vatMonth)}</CardTitle>
            <Button variant="link" asChild>
              <Link to="/app/analytics/vat">View VAT Report</Link>
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alert: {lowStock.count} item{lowStock.count === 1 ? '' : 's'} below reorder level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Stock looks healthy.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {lowStock.items.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    {item.name} ({item.quantity_in_stock}/{item.reorder_level})
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" className="px-0" asChild>
              <Link to="/app/inventory">Manage inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue this month</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => formatKes(value)} />
              <Line type="monotone" dataKey="revenue" stroke="#1f7a4d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent invoices</CardTitle>
            <Button variant="link" asChild>
              <Link to="/app/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.recent_invoices || []).slice(0, 5).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link className="underline" to={`/app/invoices/${invoice.id}`}>
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.customer_name}</TableCell>
                    <TableCell>{formatKes(invoice.total_kes)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.payment_status}>{invoice.payment_status}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(invoice.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent customers</CardTitle>
            <Button variant="link" asChild>
              <Link to="/app/customers">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.recent_customers || []).slice(0, 5).map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      {customer.name} {customer.is_repeat && <Badge variant="secondary">Repeat</Badge>}
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{formatKes(customer.total_spent_kes)}</TableCell>
                    <TableCell>{customer.visit_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-3">
        <div className="rounded-md bg-secondary p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
