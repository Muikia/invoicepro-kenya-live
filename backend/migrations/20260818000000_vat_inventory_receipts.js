/**
 * VAT, inventory, and receipt-share schema from the InvoicePro Kenya build spec.
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE invoices ADD COLUMN vat_rate DECIMAL(5, 2) DEFAULT 16.00;
    ALTER TABLE invoices ADD COLUMN subtotal_kes DECIMAL(12, 2);
    ALTER TABLE invoices ADD COLUMN vat_amount_kes DECIMAL(12, 2);
    ALTER TABLE invoices ADD COLUMN total_kes_after_vat DECIMAL(12, 2);
    ALTER TABLE invoices ADD COLUMN receipt_share_token VARCHAR(64);

    ALTER TABLE invoice_items ADD COLUMN vat_exempt BOOLEAN DEFAULT FALSE;

    UPDATE invoices SET
      subtotal_kes = total_kes,
      vat_amount_kes = 0,
      total_kes_after_vat = total_kes
    WHERE subtotal_kes IS NULL;

    CREATE TABLE inventory_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(50),
      unit_price DECIMAL(12, 2),
      quantity_in_stock INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      unit_type VARCHAR(50) DEFAULT 'piece',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE invoice_to_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_item_id UUID NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      quantity_sold INTEGER NOT NULL
    );

    CREATE TABLE vat_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_vat_registered BOOLEAN DEFAULT FALSE,
      vat_pin VARCHAR(20),
      default_vat_rate DECIMAL(5, 2) DEFAULT 16.00,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id)
    );

    CREATE TABLE vat_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month INTEGER,
      year INTEGER,
      total_sales DECIMAL(12, 2),
      total_vat_collected DECIMAL(12, 2),
      generated_date TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, month, year)
    );

    CREATE INDEX idx_inventory_user_id ON inventory_items(user_id);
    CREATE INDEX idx_vat_user_id ON vat_settings(user_id);
    CREATE INDEX idx_invoice_share_token ON invoices(receipt_share_token);
    CREATE INDEX idx_invoice_to_inventory_item ON invoice_to_inventory(inventory_item_id);
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS invoice_to_inventory;
    DROP TABLE IF EXISTS inventory_items;
    DROP TABLE IF EXISTS vat_reports;
    DROP TABLE IF EXISTS vat_settings;
    ALTER TABLE invoice_items DROP COLUMN IF EXISTS vat_exempt;
    ALTER TABLE invoices DROP COLUMN IF EXISTS receipt_share_token;
    ALTER TABLE invoices DROP COLUMN IF EXISTS total_kes_after_vat;
    ALTER TABLE invoices DROP COLUMN IF EXISTS vat_amount_kes;
    ALTER TABLE invoices DROP COLUMN IF EXISTS subtotal_kes;
    ALTER TABLE invoices DROP COLUMN IF EXISTS vat_rate;
  `);
};
