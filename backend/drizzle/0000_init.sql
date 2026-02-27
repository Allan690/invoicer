-- Invoicer Database Initialization Script (Drizzle Migration)
-- This migration creates the initial schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Invoice status enum
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table (freelancer accounts)
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" varchar(255) UNIQUE NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "full_name" varchar(255) NOT NULL,
    "business_name" varchar(255),
    "address" text,
    "phone" varchar(50),
    "logo_url" varchar(500),
    "default_currency" varchar(3) DEFAULT 'GBP',
    "tax_number" varchar(100),
    "bank_name" varchar(255),
    "bank_account_number" varchar(100),
    "bank_sort_code" varchar(50),
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS "clients" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "email" varchar(255),
    "phone" varchar(50),
    "address" text,
    "company_name" varchar(255),
    "tax_number" varchar(100),
    "notes" text,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
    "invoice_number" varchar(50) NOT NULL,
    "status" invoice_status DEFAULT 'draft',
    "issue_date" date NOT NULL DEFAULT CURRENT_DATE,
    "due_date" date,
    "due_terms" varchar(50) DEFAULT 'on_receipt',
    "currency" varchar(3) DEFAULT 'GBP',
    "subtotal" decimal(12, 2) DEFAULT 0,
    "tax_rate" decimal(5, 2) DEFAULT 0,
    "tax_amount" decimal(12, 2) DEFAULT 0,
    "discount_type" varchar(20),
    "discount_value" decimal(12, 2) DEFAULT 0,
    "discount_amount" decimal(12, 2) DEFAULT 0,
    "total" decimal(12, 2) DEFAULT 0,
    "amount_paid" decimal(12, 2) DEFAULT 0,
    "balance_due" decimal(12, 2) DEFAULT 0,
    "notes" text,
    "terms" text,
    "footer" text,
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("user_id", "invoice_number")
);

-- Invoice items/line items
CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "description" text NOT NULL,
    "quantity" decimal(10, 2) DEFAULT 1,
    "rate" decimal(12, 2) NOT NULL,
    "amount" decimal(12, 2) NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS "payments" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "amount" decimal(12, 2) NOT NULL,
    "payment_date" date NOT NULL DEFAULT CURRENT_DATE,
    "payment_method" varchar(50),
    "reference" varchar(255),
    "notes" text,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Invoice templates/settings
CREATE TABLE IF NOT EXISTS "invoice_templates" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "name" varchar(100) NOT NULL,
    "primary_color" varchar(7) DEFAULT '#4A5568',
    "is_default" boolean DEFAULT FALSE,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table (for tracking business expenses)
CREATE TABLE IF NOT EXISTS "expenses" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
    "category" varchar(100),
    "description" text NOT NULL,
    "amount" decimal(12, 2) NOT NULL,
    "currency" varchar(3) DEFAULT 'GBP',
    "expense_date" date NOT NULL DEFAULT CURRENT_DATE,
    "receipt_url" varchar(500),
    "is_billable" boolean DEFAULT FALSE,
    "is_billed" boolean DEFAULT FALSE,
    "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Invoice sequence for generating invoice numbers
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
    "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "prefix" varchar(20) DEFAULT 'INV',
    "next_number" integer DEFAULT 1,
    "padding" integer DEFAULT 4
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON "users";
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON "users"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON "clients";
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON "clients"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON "invoices";
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON "invoices"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON "invoice_items";
CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON "invoice_items"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON "invoice_templates";
CREATE TRIGGER update_invoice_templates_updated_at
    BEFORE UPDATE ON "invoice_templates"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON "expenses";
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON "expenses"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_clients_user_id" ON "clients"("user_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_user_id" ON "invoices"("user_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_client_id" ON "invoices"("client_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "idx_invoices_issue_date" ON "invoices"("issue_date");
CREATE INDEX IF NOT EXISTS "idx_invoices_due_date" ON "invoices"("due_date");
CREATE INDEX IF NOT EXISTS "idx_invoice_items_invoice_id" ON "invoice_items"("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_payments_invoice_id" ON "payments"("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_user_id" ON "expenses"("user_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_client_id" ON "expenses"("client_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_expense_date" ON "expenses"("expense_date");
