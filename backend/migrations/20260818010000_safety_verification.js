/**
 * Email/phone verification, account deletion flow, and repeat-customer flags.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE users
      ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN email_verified_at TIMESTAMP,
      ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN phone_verified_at TIMESTAMP,
      ADD COLUMN preferred_verification_method VARCHAR(50) DEFAULT 'sms',
      ADD COLUMN deleted_at TIMESTAMP;

    ALTER TABLE customers
      ADD COLUMN is_repeat_customer BOOLEAN DEFAULT FALSE,
      ADD COLUMN repeat_customer_since TIMESTAMP;

    UPDATE users SET email_verified = TRUE, email_verified_at = COALESCE(created_at, NOW())
    WHERE email_verified IS DISTINCT FROM TRUE;

    UPDATE customers SET
      is_repeat_customer = TRUE,
      repeat_customer_since = (
        SELECT MIN(created_at) FROM invoices WHERE customer_id = customers.id
      )
    WHERE (SELECT COUNT(*) FROM invoices WHERE customer_id = customers.id) >= 2;

    CREATE TABLE email_verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      used_at TIMESTAMP,
      used BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE phone_verification_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP,
      used_at TIMESTAMP,
      used BOOLEAN DEFAULT FALSE,
      delivery_method VARCHAR(20) DEFAULT 'sms'
    );

    CREATE TABLE deletion_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_at TIMESTAMP DEFAULT NOW(),
      confirmed_at TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      cancellation_reason VARCHAR(255),
      failed_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP
    );

    CREATE INDEX idx_email_verification_user_id ON email_verification_codes(user_id);
    CREATE INDEX idx_phone_verification_user_id ON phone_verification_codes(user_id);
    CREATE INDEX idx_customers_repeat ON customers(is_repeat_customer);
    CREATE INDEX idx_deletion_requests_user_id ON deletion_requests(user_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS deletion_requests;
    DROP TABLE IF EXISTS phone_verification_codes;
    DROP TABLE IF EXISTS email_verification_codes;
    ALTER TABLE customers DROP COLUMN IF EXISTS repeat_customer_since;
    ALTER TABLE customers DROP COLUMN IF EXISTS is_repeat_customer;
    ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
    ALTER TABLE users DROP COLUMN IF EXISTS preferred_verification_method;
    ALTER TABLE users DROP COLUMN IF EXISTS phone_verified_at;
    ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;
    ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
    ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
  `);
};
