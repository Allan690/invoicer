import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  date,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'cancelled',
]);

// Users table (freelancer accounts)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  businessName: varchar('business_name', { length: 255 }),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('GBP'),
  taxNumber: varchar('tax_number', { length: 100 }),
  bankName: varchar('bank_name', { length: 255 }),
  bankAccountNumber: varchar('bank_account_number', { length: 100 }),
  bankSortCode: varchar('bank_sort_code', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Clients table
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    companyName: varchar('company_name', { length: 255 }),
    taxNumber: varchar('tax_number', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_clients_user_id').on(table.userId)]
);

// Invoices table
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    status: invoiceStatusEnum('status').default('draft'),
    issueDate: date('issue_date').notNull().defaultNow(),
    dueDate: date('due_date'),
    dueTerms: varchar('due_terms', { length: 50 }).default('on_receipt'),
    currency: varchar('currency', { length: 3 }).default('GBP'),
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).default('0'),
    taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0'),
    discountType: varchar('discount_type', { length: 20 }),
    discountValue: decimal('discount_value', { precision: 12, scale: 2 }).default('0'),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
    total: decimal('total', { precision: 12, scale: 2 }).default('0'),
    amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).default('0'),
    balanceDue: decimal('balance_due', { precision: 12, scale: 2 }).default('0'),
    notes: text('notes'),
    terms: text('terms'),
    footer: text('footer'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_invoices_user_id').on(table.userId),
    index('idx_invoices_client_id').on(table.clientId),
    index('idx_invoices_status').on(table.status),
    index('idx_invoices_issue_date').on(table.issueDate),
    index('idx_invoices_due_date').on(table.dueDate),
    unique('invoices_user_id_invoice_number_unique').on(table.userId, table.invoiceNumber),
  ]
);

// Invoice items/line items
export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1'),
    rate: decimal('rate', { precision: 12, scale: 2 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_invoice_items_invoice_id').on(table.invoiceId)]
);

// Payments table
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull().defaultNow(),
    paymentMethod: varchar('payment_method', { length: 50 }),
    reference: varchar('reference', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_payments_invoice_id').on(table.invoiceId)]
);

// Invoice templates/settings
export const invoiceTemplates = pgTable('invoice_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  primaryColor: varchar('primary_color', { length: 7 }).default('#4A5568'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Expenses table (for tracking business expenses)
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    category: varchar('category', { length: 100 }),
    description: text('description').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('GBP'),
    expenseDate: date('expense_date').notNull().defaultNow(),
    receiptUrl: varchar('receipt_url', { length: 500 }),
    isBillable: boolean('is_billable').default(false),
    isBilled: boolean('is_billed').default(false),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_expenses_user_id').on(table.userId),
    index('idx_expenses_client_id').on(table.clientId),
    index('idx_expenses_expense_date').on(table.expenseDate),
  ]
);

// Invoice sequence for generating invoice numbers
export const invoiceSequences = pgTable('invoice_sequences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  prefix: varchar('prefix', { length: 20 }).default('INV'),
  nextNumber: integer('next_number').default(1),
  padding: integer('padding').default(4),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  clients: many(clients),
  invoices: many(invoices),
  invoiceTemplates: many(invoiceTemplates),
  expenses: many(expenses),
  invoiceSequence: one(invoiceSequences, {
    fields: [users.id],
    references: [invoiceSequences.userId],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
  expenses: many(expenses),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
  expenses: many(expenses),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const invoiceTemplatesRelations = relations(invoiceTemplates, ({ one }) => ({
  user: one(users, {
    fields: [invoiceTemplates.userId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [expenses.clientId],
    references: [clients.id],
  }),
  invoice: one(invoices, {
    fields: [expenses.invoiceId],
    references: [invoices.id],
  }),
}));

export const invoiceSequencesRelations = relations(invoiceSequences, ({ one }) => ({
  user: one(users, {
    fields: [invoiceSequences.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type NewInvoiceTemplate = typeof invoiceTemplates.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type NewInvoiceSequence = typeof invoiceSequences.$inferInsert;

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
