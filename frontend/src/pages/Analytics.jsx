import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Link } from 'react-router-dom';
import { formatKes } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const COLORS = ['#1f7a4d', '#eab308', '#0ea5e9', '#ef4444'];

export default function Analytics() {
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [revenue, setRevenue] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLocked, setProductsLocked] = useState(false);
  const [retention, setRetention] = useState(null);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params =
      range === 'custom'
        ? { from, to }
        : { range, period: range };
    if (range === 'custom' && (!from || !to)) return;
    setLoading(true);
    Promise.all([
      api.get('/analytics/revenue', { params }),
      api.get('/analytics/top-services', { params }),
      api.get('/analytics/top-products', { params: { ...params, limit: 5 } }),
      api.get('/analytics/customer-retention', { params }),
      api.get('/analytics/payment-methods', { params }),
    ])
      .then(([rev, top, prod, ret, pay]) => {
        setRevenue((rev.data.days || []).map((d) => ({ day: String(d.day).slice(5, 10), revenue: Number(d.revenue) })));
        setServices(top.data.services || []);
        setProducts(Array.isArray(prod.data.products) ? prod.data.products : []);
        setProductsLocked(Boolean(prod.data.upgrade_required));
        setRetention(ret.data);
        setMethods(pay.data.methods || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [range, from, to]);

  const monthTotal = revenue.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/analytics/vat">VAT Report</Link>
          </Button>
          <select className="h-10 rounded-md border px-3 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="30days">Last 30 Days</option>
            <option value="year">This Year</option>
            <option value="3months">Last 3 Months</option>
            <option value="custom">Custom</option>
          </select>
          {range === 'custom' && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
            </>
          )}
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Loading analytics...</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue This Month</CardTitle>
            <p className="text-2xl font-bold">{formatKes(monthTotal)}</p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => formatKes(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#1f7a4d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Products/Services</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {productsLocked ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">Top products are on Basic and Pro.</p>
                <Button asChild>
                  <Link to="/app/upgrade">Upgrade Now</Link>
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={products} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="service" width={110} />
                  <Tooltip formatter={(value, name) => (name === 'revenue' ? formatKes(value) : value)} />
                  <Bar dataKey="revenue" name="revenue">
                    {products.map((entry, index) => (
                      <Cell key={entry.service} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {!productsLocked && products.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {products.map((item, index) => (
                  <li key={item.service} className="flex justify-between gap-2">
                    <span>
                      {index + 1}. {item.service}
                    </span>
                    <span>
                      {formatKes(item.revenue)} · {item.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Services (count)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="description" hide={services.length > 4} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1f7a4d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {retention && (
              <div className="space-y-2 text-sm">
                <p>Total customers: {retention.total_customers}</p>
                <p>Repeat customers: {retention.repeat_customers}</p>
                <p>New customers: {retention.new_customers}</p>
                <p className="text-lg font-semibold">Repeat customer revenue: {retention.repeat_customer_rate}%</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methods} dataKey="total_kes" nameKey="payment_method" outerRadius={90} label>
                  {methods.map((entry, index) => (
                    <Cell key={entry.payment_method} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatKes(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
