import type { Request, Response, NextFunction } from 'express';
import type { User } from '../db/schema.js';

// Extend Express Request type to include user and userId
declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'email' | 'fullName' | 'businessName' | 'defaultCurrency'>;
      userId?: string;
    }
  }
}

// User-related types
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  businessName: string | null;
  defaultCurrency: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  taxNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankSortCode?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// JWT payload types
export interface JwtPayload {
  userId: string;
  type?: 'refresh';
  iat?: number;
  exp?: number;
}

// API response types
export interface ApiResponse<T = unknown> {
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Client types for API responses
export interface ClientResponse {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  taxNumber: string | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  invoiceCount?: number;
  totalBilled?: number;
  totalOutstanding?: number;
}

// Invoice types for API responses
export interface InvoiceItemInput {
  description: string;
  quantity?: number;
  rate?: number;
}

export interface InvoiceInput {
  clientId: string;
  issueDate?: string;
  dueDate?: string;
  dueTerms?: string;
  currency?: string;
  taxRate?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  notes?: string;
  terms?: string;
  footer?: string;
  items?: InvoiceItemInput[];
}

export interface InvoiceWithClient {
  id: string;
  userId: string;
  clientId: string;
  invoiceNumber: string;
  status: string | null;
  issueDate: string;
  dueDate: string | null;
  dueTerms: string | null;
  currency: string | null;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  discountType: string | null;
  discountValue: string | null;
  discountAmount: string | null;
  total: string | null;
  amountPaid: string | null;
  balanceDue: string | null;
  notes: string | null;
  terms: string | null;
  footer: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  clientCompany: string | null;
  clientTaxNumber?: string | null;
  items?: InvoiceItemResponse[];
  payments?: PaymentResponse[];
}

export interface InvoiceItemResponse {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string | null;
  rate: string;
  amount: string;
  sortOrder: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PaymentResponse {
  id: string;
  invoiceId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date | null;
}

export interface PaymentInput {
  amount: number;
  paymentDate?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

// Dashboard types
export interface DashboardStats {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  yearRevenue: number;
  monthRevenue: number;
  clientCount: number;
  invoicesByStatus: Record<string, { count: number; totalAmount: number }>;
  recentInvoices: InvoiceWithClient[];
  currentYear: number;
  currentMonth: number;
}

export interface MonthlyRevenueData {
  month: number;
  monthName: string;
  revenue: number;
  invoiced: number;
  invoiceCount: number;
}

export interface TopClient {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
}

// Settings types
export interface UserProfileInput {
  fullName?: string;
  businessName?: string;
  address?: string;
  phone?: string;
  defaultCurrency?: string;
  taxNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
}

export interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  padding: number;
  previewNumber: string;
}

export interface InvoiceTemplateInput {
  name: string;
  primaryColor?: string;
  isDefault?: boolean;
}

// Error types
export interface ValidationErrorDetail {
  field?: string;
  message: string;
  value?: unknown;
}

// Express handler types
export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

// Query parameter types
export interface InvoiceQueryParams {
  status?: string;
  client_id?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: string;
  limit?: string;
}

export interface ClientQueryParams {
  search?: string;
  limit?: string;
  offset?: string;
}

export interface DashboardQueryParams {
  year?: string;
  month?: string;
}
