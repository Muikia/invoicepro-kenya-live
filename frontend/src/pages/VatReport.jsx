import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatDate, formatKes } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function VatReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/vat/report', { params: { month, year } })
      .then((res) => setReport(res.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [month, year]);

  const years = useMemo(() => {
    const current = now.getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, [now]);

  function downloadCsv() {
    if (!report?.invoices) return;
    const header = ['Invoice', 'Date', 'Customer', 'Subtotal', 'VAT', 'Total', 'Status'];
    const rows = report.invoices.map((invoice) => [
      invoice.invoice_number,
      formatDate(invoice.created_at),
      invoice.customer_name,
      invoice.subtotal_kes,
      invoice.vat_amount_kes,
      invoice.total_kes,
      invoice.payment_status,
    ]);
    rows.push(['TOTALS', '', '', '', report.total_vat_collected, report.total_sales, '']);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VAT-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (report?.upgrade_required) {
    return (
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-bold">VAT Report</h1>
        <p className="text-muted-foreground">VAT reports are on Basic and Pro. Track 16% VAT and export for KRA filing.</p>
        <Button asChild>
          <Link to="/app/upgrade">Upgrade Now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">VAT Report</h1>
          <p className="text-sm text-muted-foreground">For KRA filing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-md border px-3 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border px-3 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={downloadCsv} disabled={!report?.invoices?.length}>
            Export CSV
          </Button>
          <Button onClick={downloadCsv} disabled={!report?.invoices?.length}>
            Download for KRA Filing
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <p className="text-muted-foreground">Loading VAT report...</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total sales</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{formatKes(report.total_sales)}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total VAT collected</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{formatKes(report.total_vat_collected)}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Taxable invoices</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>VAT</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.invoices || []).map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Link className="underline" to={`/app/invoices/${invoice.id}`}>
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(invoice.created_at)}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{formatKes(invoice.subtotal_kes)}</TableCell>
                      <TableCell>{formatKes(invoice.vat_amount_kes)}</TableCell>
                      <TableCell>{formatKes(invoice.total_kes)}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.payment_status}>{invoice.payment_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!report.invoices?.length && <p className="text-sm text-muted-foreground mt-3">No invoices in this month.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
