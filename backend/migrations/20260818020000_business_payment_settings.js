/**
 * Multi-tenant payment settings: each business stores its own M-Pesa / bank details.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS business_payment_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      mpesa_enabled BOOLEAN DEFAULT TRUE,
      mpesa_type VARCHAR(20),
      mpesa_paybill_number VARCHAR(20),
      mpesa_till_number VARCHAR(20),
      mpesa_account_display_name VARCHAR(100),
      bank_transfer_enabled BOOLEAN DEFAULT FALSE,
      bank_account_number VARCHAR(50),
      bank_account_name VARCHAR(100),
      bank_name VARCHAR(100),
      bank_branch VARCHAR(100),
      card_payments_enabled BOOLEAN DEFAULT FALSE,
      card_processor VARCHAR(50),
      cash_enabled BOOLEAN DEFAULT TRUE,
      auto_reconciliation_enabled BOOLEAN DEFAULT FALSE,
      reconciliation_method VARCHAR(50),
      pesapal_merchant_id VARCHAR(100),
      pesapal_consumer_key VARCHAR(255),
      pesapal_consumer_secret VARCHAR(255),
      pesapal_paybill_linked VARCHAR(20),
      daraja_enabled BOOLEAN DEFAULT FALSE,
      daraja_consumer_key VARCHAR(255),
      daraja_consumer_secret VARCHAR(255),
      daraja_business_shortcode VARCHAR(20),
      daraja_passkey VARCHAR(255),
      sms_reminders_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
      payment_method VARCHAR(50),
      amount_kes DECIMAL(12, 2),
      status VARCHAR(50),
      status_message TEXT,
      external_reference VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_kes DECIMAL(12, 2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_received_from VARCHAR(50);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference_from_customer VARCHAR(100);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pesapal_receipt_code VARCHAR(100);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS auto_reconciliation_matched BOOLEAN DEFAULT FALSE;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS received_by_business_at TIMESTAMP;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

    CREATE INDEX IF NOT EXISTS idx_payment_settings_user ON business_payment_settings(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_logs_invoice_id ON payment_logs(invoice_id);

    INSERT INTO business_payment_settings (user_id, mpesa_enabled, cash_enabled, mpesa_till_number, mpesa_type)
    SELECT id, TRUE, TRUE, m_pesa_number, CASE WHEN m_pesa_number IS NULL THEN NULL ELSE 'till' END
    FROM users
    WHERE NOT EXISTS (
      SELECT 1 FROM business_payment_settings s WHERE s.user_id = users.id
    );
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS payment_logs;
    DROP TABLE IF EXISTS business_payment_settings;
  `);
};
