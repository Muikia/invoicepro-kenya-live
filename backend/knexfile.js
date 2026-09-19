const path = require('path');
require('dotenv').config();

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL_UNPOOLED;

const connection = databaseUrl || {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'invoicepro',
  password: process.env.PGPASSWORD || 'invoicepro',
  database: process.env.PGDATABASE || 'invoicepro',
};

const ssl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  (typeof databaseUrl === 'string' &&
    (databaseUrl.includes('render.com') || databaseUrl.includes('neon.tech') || databaseUrl.includes('vercel-storage')))
    ? { rejectUnauthorized: false }
    : false;

module.exports = {
  development: {
    client: 'pg',
    connection: typeof connection === 'string' ? { connectionString: connection, ssl } : { ...connection, ssl },
    migrations: { directory: path.join(__dirname, 'migrations') },
    pool: { min: 0, max: 1 },
  },
  production: {
    client: 'pg',
    connection: { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } },
    migrations: { directory: path.join(__dirname, 'migrations') },
    pool: { min: 0, max: 5 },
  },
};
