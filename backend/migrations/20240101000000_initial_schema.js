/**
 * Exact InvoicePro Kenya schema from the build specification.
 * Column names must not change.
 */
exports.up = async function up(knex) {
  const version = await knex.raw('select version()');
  const versionText = version.rows?.[0]?.version || version?.[0]?.version || '';
  if (!String(versionText).includes('PGlite')) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }

  await knex.raw(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      business_name VARCHAR(255) NOT NULL,
      business_type VARCHAR(50),
      subscription_tier VARCHAR(20) DEFAULT 'free',
      subscription_date TIMESTAMP,
      m_pesa_number VARCHAR(20),
      profile_picture_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      total_spent_kes DECIMAL(12, 2) DEFAULT 0,
      visit_count INTEGER DEFAULT 0,
      last_visit_date TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, phone)
    );

    CREATE TABLE invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      invoice_number VARCHAR(20) NOT NULL,
      total_kes DECIMAL(12, 2) NOT NULL,
      paid_amount DECIMAL(12, 2) DEFAULT 0,
      payment_status VARCHAR(20) DEFAULT 'unpaid',
      payment_method VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(12, 2) NOT NULL,
      total_kes DECIMAL(12, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE subscription_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_tier VARCHAR(20),
      to_tier VARCHAR(20),
      change_date TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE invoice_counters (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_count INTEGER DEFAULT 0,
      reset_date TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount_kes DECIMAL(12, 2) NOT NULL,
      payment_method VARCHAR(50),
      mpesa_receipt_code VARCHAR(50),
      payment_date TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_customers_user_id ON customers(user_id);
    CREATE INDEX idx_invoices_user_id ON invoices(user_id);
    CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
    CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
    CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS invoice_items;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS invoice_counters;
    DROP TABLE IF EXISTS subscription_logs;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS users;
  `);
};
