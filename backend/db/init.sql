-- Invoicer Database Initialization Script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (freelancer accounts)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    logo_url VARCHAR(500),
    default_currency VARCHAR(3) DEFAULT 'GBP',
    tax_number VARCHAR(100),
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(100),
    bank_sort_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    company_name VARCHAR(255),
    tax_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    status invoice_status DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    due_terms VARCHAR(50) DEFAULT 'on_receipt',
    currency VARCHAR(3) DEFAULT 'GBP',
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_type VARCHAR(20),
    discount_value DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    balance_due DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    terms TEXT,
    footer TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, invoice_number)
);

-- Invoice items/line items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    rate DECIMAL(12, 2) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice templates/settings
CREATE TABLE invoice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    primary_color VARCHAR(7) DEFAULT '#4A5568',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table (for tracking business expenses)
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    category VARCHAR(100),
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url VARCHAR(500),
    is_billable BOOLEAN DEFAULT FALSE,
    is_billed BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoice sequence for generating invoice numbers
CREATE TABLE invoice_sequences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefix VARCHAR(20) DEFAULT 'INV',
    next_number INTEGER DEFAULT 1,
    padding INTEGER DEFAULT 4
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
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_templates_updated_at
    BEFORE UPDATE ON invoice_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better query performance
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_client_id ON expenses(client_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(20);
    v_next_number INTEGER;
    v_padding INTEGER;
    v_invoice_number VARCHAR(50);
BEGIN
    -- Get or create sequence for user
    INSERT INTO invoice_sequences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current sequence values and increment
    UPDATE invoice_sequences
    SET next_number = next_number + 1
    WHERE user_id = p_user_id
    RETURNING prefix, next_number - 1, padding
    INTO v_prefix, v_next_number, v_padding;

    -- Format the invoice number
    v_invoice_number := v_prefix || LPAD(v_next_number::TEXT, v_padding, '0');

    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals(p_invoice_id UUID)
RETURNS void AS $$
DECLARE
    v_subtotal DECIMAL(12, 2);
    v_tax_rate DECIMAL(5, 2);
    v_tax_amount DECIMAL(12, 2);
    v_discount_type VARCHAR(20);
    v_discount_value DECIMAL(12, 2);
    v_discount_amount DECIMAL(12, 2);
    v_total DECIMAL(12, 2);
    v_amount_paid DECIMAL(12, 2);
BEGIN
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(amount), 0)
    INTO v_subtotal
    FROM invoice_items
    WHERE invoice_id = p_invoice_id;

    -- Get invoice settings
    SELECT tax_rate, discount_type, discount_value, amount_paid
    INTO v_tax_rate, v_discount_type, v_discount_value, v_amount_paid
    FROM invoices
    WHERE id = p_invoice_id;

    -- Calculate discount
    IF v_discount_type = 'percentage' THEN
        v_discount_amount := v_subtotal * (v_discount_value / 100);
    ELSIF v_discount_type = 'fixed' THEN
        v_discount_amount := v_discount_value;
    ELSE
        v_discount_amount := 0;
    END IF;

    -- Calculate tax
    v_tax_amount := (v_subtotal - v_discount_amount) * (v_tax_rate / 100);

    -- Calculate total
    v_total := v_subtotal - v_discount_amount + v_tax_amount;

    -- Update invoice
    UPDATE invoices
    SET subtotal = v_subtotal,
        tax_amount = v_tax_amount,
        discount_amount = v_discount_amount,
        total = v_total,
        balance_due = v_total - v_amount_paid
    WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;
