const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const invoiceRoutes = require('./routes/invoices');
const analyticsRoutes = require('./routes/analytics');
const subscriptionRoutes = require('./routes/subscription');
const userRoutes = require('./routes/user');
const inventoryRoutes = require('./routes/inventory');
const vatRoutes = require('./routes/vat');
const publicRoutes = require('./routes/public');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/\.onrender\.com$/.test(origin) || /\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in a few minutes.' },
  })
);

let migratePromise = null;
function ensureMigrated() {
  if (!migratePromise) {
    migratePromise = db.migrate.latest();
  }
  return migratePromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureMigrated();
    return next();
  } catch (err) {
    return next(err);
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.raw('select 1');
    return res.json({
      status: 'ok',
      ok: true,
      service: 'invoicepro-kenya',
      env: process.env.NODE_ENV || 'development',
      database: true,
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[health] database check failed');
    return res.status(503).json({
      ok: false,
      service: 'invoicepro-kenya',
      env: process.env.NODE_ENV || 'development',
      database: false,
      error: 'Database unavailable',
      time: new Date().toISOString(),
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/user', userRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/vat', vatRoutes);
app.use('/api/public', publicRoutes);

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  return res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      return res.status(404).json({ error: 'Frontend not built yet' });
    }
    return undefined;
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = { app, ensureMigrated };
