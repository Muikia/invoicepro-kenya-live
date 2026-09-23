const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified } = require('../middleware/auth');
const { hasFeature } = require('../utils/features');

const router = express.Router();
router.use(requireAuth);
router.use(requireEmailVerified);

function dateRange(query) {
  const range = String(query.period || query.range || 'month').trim();
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime())) {
    return { from, to };
  }
  if (range === '3months') {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: new Date() };
  }
  if (range === 'week') {
    const start = new Date();
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: new Date() };
  }
  if (range === '30days' || range === 'last30') {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: new Date() };
  }
  if (range === 'year') {
    const start = new Date();
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: new Date() };
  }

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: new Date() };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const monthStartSql = "DATE_TRUNC('month', NOW())";

    const monthStats = await db('invoices')
      .where({ user_id: userId })
      .andWhereRaw(`created_at >= ${monthStartSql}`)
      .select(db.raw('COALESCE(SUM(total_kes), 0) as revenue'), db.raw('COUNT(*) as invoice_count'))
      .first();
    const todayStats = await db('invoices')
      .where({ user_id: userId })
      .andWhereRaw("created_at >= DATE_TRUNC('day', NOW())")
      .count('* as count')
      .first();
    const customerStats = await db('customers').where({ user_id: userId }).count('* as count').first();
    const repeatStats = await db('invoices as i')
      .join('customers as c', 'c.id', 'i.customer_id')
      .where('i.user_id', userId)
      .andWhereRaw(`i.created_at >= ${monthStartSql}`)
      .select(
        db.raw('COALESCE(SUM(i.total_kes), 0) as total_revenue'),
        db.raw('COALESCE(SUM(CASE WHEN c.visit_count > 1 THEN i.total_kes ELSE 0 END), 0) as repeat_revenue')
      )
      .first();
    const recentInvoices = await db('invoices as i')
      .join('customers as c', 'c.id', 'i.customer_id')
      .where('i.user_id', userId)
      .select('i.*', 'c.name as customer_name', 'c.phone as customer_phone')
      .orderBy('i.created_at', 'desc')
      .limit(10);
    const recentCustomers = await db('customers')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(10);

    const totalRevenue = Number(repeatStats.total_revenue || 0);
    const repeatRevenue = Number(repeatStats.repeat_revenue || 0);
    const repeatRate = totalRevenue > 0 ? Math.round((repeatRevenue / totalRevenue) * 100) : 0;
    const vatStats = await db('invoices')
      .where({ user_id: userId })
      .andWhereRaw(`created_at >= ${monthStartSql}`)
      .select(db.raw('COALESCE(SUM(vat_amount_kes), 0) as vat'))
      .first();

    return res.json({
      monthly_revenue: Number(monthStats.revenue || 0),
      invoices_this_month: Number(monthStats.invoice_count || 0),
      invoices_today: Number(todayStats.count || 0),
      total_customers: Number(customerStats.count || 0),
      repeat_customer_rate: repeatRate,
      vat_this_month: Number(vatStats?.vat || 0),
      recent_invoices: recentInvoices.map((invoice) => ({
        ...invoice,
        total_kes: Number(invoice.total_kes),
        paid_amount: Number(invoice.paid_amount || 0),
      })),
      recent_customers: recentCustomers.map((customer) => ({
        ...customer,
        total_spent_kes: Number(customer.total_spent_kes || 0),
        visit_count: Number(customer.visit_count || 0),
        is_repeat: Number(customer.visit_count || 0) > 1,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/revenue', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const rows = await db('invoices')
      .where({ user_id: req.user.id })
      .andWhere('created_at', '>=', from)
      .andWhere('created_at', '<=', to)
      .select(db.raw('DATE(created_at) as day'), db.raw('COALESCE(SUM(total_kes), 0) as revenue'))
      .groupByRaw('DATE(created_at)')
      .orderBy('day', 'asc');

    return res.json({
      from,
      to,
      days: rows.map((row) => ({
        day: row.day,
        revenue: Number(row.revenue),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/top-products', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'top_products')) {
      return res.json({ products: [], upgrade_required: true });
    }

    const { from, to } = dateRange(req.query);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);
    const rows = await db('invoice_items as ii')
      .join('invoices as i', 'i.id', 'ii.invoice_id')
      .where('i.user_id', req.user.id)
      .andWhere('i.created_at', '>=', from)
      .andWhere('i.created_at', '<=', to)
      .select('ii.description')
      .sum({ total_revenue: 'ii.total_kes' })
      .count({ times_sold: '*' })
      .groupBy('ii.description')
      .orderBy('total_revenue', 'desc')
      .limit(limit);

    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);
    return res.json({
      upgrade_required: false,
      products: rows.map((row) => ({
        service: row.description,
        revenue: Number(row.total_revenue || 0),
        count: Number(row.times_sold || 0),
        percentage: totalRevenue > 0 ? Math.round((Number(row.total_revenue || 0) * 1000) / totalRevenue) / 10 : 0,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/top-services', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const rows = await db('invoice_items as ii')
      .join('invoices as i', 'i.id', 'ii.invoice_id')
      .where('i.user_id', req.user.id)
      .andWhere('i.created_at', '>=', from)
      .andWhere('i.created_at', '<=', to)
      .select('ii.description')
      .sum({ total_kes: 'ii.total_kes' })
      .count({ count: '*' })
      .groupBy('ii.description')
      .orderBy('count', 'desc')
      .limit(10);

    return res.json({
      services: rows.map((row) => ({
        description: row.description,
        count: Number(row.count),
        total_kes: Number(row.total_kes),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/customer-retention', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);

    const [customers, revenue] = await Promise.all([
      db('customers')
        .where({ user_id: req.user.id })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(*) FILTER (WHERE visit_count > 1) as repeat_customers'),
          db.raw('COUNT(*) FILTER (WHERE visit_count <= 1) as new_customers')
        )
        .first(),
      db('invoices as i')
        .join('customers as c', 'c.id', 'i.customer_id')
        .where('i.user_id', req.user.id)
        .andWhere('i.created_at', '>=', from)
        .andWhere('i.created_at', '<=', to)
        .select(
          db.raw('COALESCE(SUM(i.total_kes), 0) as total_revenue'),
          db.raw('COALESCE(SUM(CASE WHEN c.visit_count > 1 THEN i.total_kes ELSE 0 END), 0) as repeat_revenue')
        )
        .first(),
    ]);

    const totalRevenue = Number(revenue.total_revenue || 0);
    const repeatRevenue = Number(revenue.repeat_revenue || 0);

    return res.json({
      total_customers: Number(customers.total || 0),
      repeat_customers: Number(customers.repeat_customers || 0),
      new_customers: Number(customers.new_customers || 0),
      total_revenue: totalRevenue,
      repeat_revenue: repeatRevenue,
      repeat_customer_rate: totalRevenue > 0 ? Math.round((repeatRevenue / totalRevenue) * 100) : 0,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/payment-methods', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const rows = await db('invoices')
      .where({ user_id: req.user.id })
      .andWhere('created_at', '>=', from)
      .andWhere('created_at', '<=', to)
      .whereNotNull('payment_method')
      .select('payment_method')
      .sum({ total_kes: 'total_kes' })
      .count({ count: '*' })
      .groupBy('payment_method');

    return res.json({
      methods: rows.map((row) => ({
        payment_method: row.payment_method,
        count: Number(row.count),
        total_kes: Number(row.total_kes),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
