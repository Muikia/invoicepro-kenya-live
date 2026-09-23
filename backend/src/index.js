const { app, ensureMigrated } = require('./app');

const PORT = process.env.PORT || 4000;

async function start() {
  const production = process.env.NODE_ENV === 'production';
  if (production && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }
  if (production && !(process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    throw new Error('DATABASE_URL is required in production');
  }

  await ensureMigrated();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(
      `InvoicePro API listening on 0.0.0.0:${PORT} env=${process.env.NODE_ENV || 'development'}`
    );
  });
}

if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = app;
