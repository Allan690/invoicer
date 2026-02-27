// User types
export interface User {
  id: number;
  email: string;
  fullName: string;
  full_name?: string;
  businessName?: string;
  business_name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  logo_url?: string;
  defaultCurrency?: string;
  default_currency?: string;
  defaultTaxRate?: number;
  default_tax_rate?: number;
  defaultPaymentTerms?: string;
  default_payment_terms?: string;
  invoicePrefix?: string;
  invoice_prefix?: string;
  invoiceNextNumber?: number;
  invoice_next_number?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

// Client types
export interface Client {
  id: number;
  userId: number;
  user_id?: number;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  company_name?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}

export interface ClientWithStats extends Client {
  invoice_count?: number;
  total_billed?: number;
  total_outstanding?: number;
}

export interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  notes?: string;
}

// Invoice types
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "cancelled";

export type DueTerms =
  | "on_receipt"
  | "net_7"
  | "net_14"
  | "net_30"
  | "net_60"
  | "custom";

export type DiscountType = "percentage" | "fixed";

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: number;
  userId: number;
  user_id?: number;
  clientId: number;
  client_id?: number;
  invoiceNumber: string;
  invoice_number?: string;
  status: InvoiceStatus;
  issueDate: string;
  issue_date?: string;
  dueDate?: string;
  due_date?: string;
  dueTerms?: DueTerms;
  due_terms?: DueTerms;
  currency: string;
  subtotal: number;
  discountType?: DiscountType;
  discount_type?: DiscountType;
  discountValue?: number;
  discount_value?: number;
  discountAmount: number;
  discount_amount?: number;
  taxRate: number;
  tax_rate?: number;
  taxAmount: number;
  tax_amount?: number;
  total: number;
  amountPaid: number;
  amount_paid?: number;
  balanceDue: number;
  balance_due?: number;
  notes?: string;
  terms?: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  // Joined fields from client
  clientName?: string;
  clientEmail?: string;
  clientCompany?: string;
  clientAddress?: string;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface InvoiceFormData {
  client_id: string | number;
  issue_date: string;
  due_date?: string;
  due_terms: DueTerms | string;
  currency: string;
  items: InvoiceItemFormData[];
  discount_type: DiscountType | string | null;
  discount_value: number | string;
  tax_rate: number | string;
  notes?: string;
  terms?: string;
}

export interface InvoiceItemFormData {
  id?: string;
  description: string;
  quantity: number | string;
  rate: number | string;
  amount?: number;
}

// Payment types
export type PaymentMethod =
  | "cash"
  | "check"
  | "bank_transfer"
  | "credit_card"
  | "paypal"
  | "other";

export interface Payment {
  id: number;
  invoiceId: number;
  invoice_id?: number;
  amount: number;
  paymentDate: string;
  payment_date?: string;
  paymentMethod?: PaymentMethod;
  payment_method?: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
  created_at?: string;
}

export interface PaymentFormData {
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  reference?: string;
  notes?: string;
}

// Dashboard types
export interface DashboardStats {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  clientCount?: number;
  monthRevenue?: number;
  yearRevenue?: number;
  invoicesByStatus?: Record<string, { count: number; totalAmount: number }>;
  recentInvoices?: Invoice[];
}

export interface MonthlyRevenue {
  month: string | number;
  monthName?: string;
  revenue: number;
}

export interface MonthlyRevenueResponse {
  year: number;
  data: MonthlyRevenue[];
  totals: {
    revenue: number;
  };
}

export interface TopClient {
  id: number;
  name: string;
  companyName?: string;
  company_name?: string;
  totalRevenue: number;
  total_revenue?: number;
  invoiceCount: number;
  invoice_count?: number;
}

export interface OverdueInvoice extends Invoice {
  daysOverdue: number;
  days_overdue?: number;
}

export interface OverdueData {
  invoices: OverdueInvoice[];
}

// Settings types
export interface ProfileSettings {
  fullName: string;
  full_name?: string;
  email: string;
  businessName?: string;
  business_name?: string;
  address?: string;
  phone?: string;
  defaultCurrency?: string;
  default_currency?: string;
  taxNumber?: string;
  tax_number?: string;
  bankName?: string;
  bank_name?: string;
  bankAccountNumber?: string;
  bank_account_number?: string;
  bankSortCode?: string;
  bank_sort_code?: string;
  user?: User;
}

export interface InvoiceSettings {
  defaultCurrency: string;
  default_currency?: string;
  defaultTaxRate: number;
  default_tax_rate?: number;
  defaultPaymentTerms: DueTerms;
  default_payment_terms?: DueTerms;
  invoicePrefix: string;
  invoice_prefix?: string;
  prefix?: string;
  invoiceNextNumber: number;
  invoice_next_number?: number;
  nextNumber?: number;
  padding?: number;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
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

// Extended response types for specific endpoints
export interface ClientsResponse {
  clients: ClientWithStats[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoicesResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message?: string;
  details?: Record<string, string>;
}

// Axios error type helper
export interface AxiosErrorResponse {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
}

// Form and UI types
export interface SelectOption {
  value: string;
  label: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  businessName?: string;
}

// Query params types
export interface InvoiceQueryParams {
  search?: string;
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

export interface ClientQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

// Form state types
export interface ProfileFormData {
  fullName: string;
  businessName: string;
  address: string;
  phone: string;
  defaultCurrency: string;
  taxNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankSortCode: string;
}

export interface InvoiceSettingsFormData {
  prefix: string;
  padding: number;
}

export interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface InvoiceFormState {
  client_id: string;
  issue_date: string;
  due_date: string;
  due_terms: string;
  currency: string;
  tax_rate: number;
  discount_type: string;
  discount_value: number;
  notes: string;
  terms: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
  }>;
}

export interface InvoiceFormErrors {
  client_id?: string;
  issue_date?: string;
  items?: string;
  [key: string]: string | undefined;
}

// Status update types
export interface StatusUpdateData {
  status: InvoiceStatus;
}
