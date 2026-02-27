import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  User,
  Client,
  ClientFormData,
  ClientQueryParams,
  Invoice,
  InvoiceFormData,
  InvoiceQueryParams,
  InvoiceStatus,
  PaymentFormData,
  DashboardStats,
  MonthlyRevenue,
  TopClient,
  ProfileSettings,
  InvoiceSettings,
  PaginatedResponse,
} from '../types';

// Extend the request config to include our custom property
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const response = await axios.post<{ token: string; refreshToken: string }>(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );

          const { token, refreshToken: newRefreshToken } = response.data;

          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API types
interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  businessName?: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// Auth API
export const authAPI = {
  login: (credentials: LoginCredentials): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/login', credentials),
  register: (data: RegisterData): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/register', data),
  logout: (): Promise<AxiosResponse<void>> => api.post('/auth/logout'),
  getMe: (): Promise<AxiosResponse<User>> => api.get('/auth/me'),
  refresh: (refreshToken: string): Promise<AxiosResponse<AuthResponse>> =>
    api.post('/auth/refresh', { refreshToken }),
};

// Clients API
export const clientsAPI = {
  getAll: (params?: ClientQueryParams): Promise<AxiosResponse<PaginatedResponse<Client>>> =>
    api.get('/clients', { params }),
  getById: (id: string | number): Promise<AxiosResponse<Client>> =>
    api.get(`/clients/${id}`),
  create: (data: ClientFormData): Promise<AxiosResponse<Client>> =>
    api.post('/clients', data),
  update: (id: string | number, data: Partial<ClientFormData>): Promise<AxiosResponse<Client>> =>
    api.put(`/clients/${id}`, data),
  delete: (id: string | number): Promise<AxiosResponse<void>> =>
    api.delete(`/clients/${id}`),
  getInvoices: (id: string | number): Promise<AxiosResponse<Invoice[]>> =>
    api.get(`/clients/${id}/invoices`),
};

// Invoices API
export const invoicesAPI = {
  getAll: (params?: InvoiceQueryParams): Promise<AxiosResponse<PaginatedResponse<Invoice>>> =>
    api.get('/invoices', { params }),
  getById: (id: string | number): Promise<AxiosResponse<Invoice>> =>
    api.get(`/invoices/${id}`),
  create: (data: InvoiceFormData): Promise<AxiosResponse<Invoice>> =>
    api.post('/invoices', data),
  update: (id: string | number, data: Partial<InvoiceFormData>): Promise<AxiosResponse<Invoice>> =>
    api.put(`/invoices/${id}`, data),
  updateStatus: (id: string | number, data: { status: InvoiceStatus }): Promise<AxiosResponse<Invoice>> =>
    api.patch(`/invoices/${id}/status`, data),
  delete: (id: string | number): Promise<AxiosResponse<void>> =>
    api.delete(`/invoices/${id}`),
  duplicate: (id: string | number): Promise<AxiosResponse<Invoice>> =>
    api.post(`/invoices/${id}/duplicate`),
  addPayment: (id: string | number, payment: PaymentFormData): Promise<AxiosResponse<Invoice>> =>
    api.post(`/invoices/${id}/payments`, payment),
  deletePayment: (invoiceId: string | number, paymentId: string | number): Promise<AxiosResponse<void>> =>
    api.delete(`/invoices/${invoiceId}/payments/${paymentId}`),
};

// Dashboard API
export const dashboardAPI = {
  getStats: (params?: Record<string, unknown>): Promise<AxiosResponse<DashboardStats>> =>
    api.get('/dashboard/stats', { params }),
  getMonthlyRevenue: (year?: number): Promise<AxiosResponse<MonthlyRevenue[]>> =>
    api.get('/dashboard/revenue/monthly', { params: { year } }),
  getTopClients: (limit?: number): Promise<AxiosResponse<TopClient[]>> =>
    api.get('/dashboard/clients/top', { params: { limit } }),
  getDueSoon: (days?: number): Promise<AxiosResponse<Invoice[]>> =>
    api.get('/dashboard/invoices/due-soon', { params: { days } }),
  getOverdue: (): Promise<AxiosResponse<Invoice[]>> =>
    api.get('/dashboard/invoices/overdue'),
  getYears: (): Promise<AxiosResponse<number[]>> =>
    api.get('/dashboard/years'),
};

// Settings API
interface Template {
  id: number;
  name: string;
  content: string;
  isDefault: boolean;
}

export const settingsAPI = {
  getProfile: (): Promise<AxiosResponse<ProfileSettings>> =>
    api.get('/settings/profile'),
  updateProfile: (data: Partial<ProfileSettings>): Promise<AxiosResponse<ProfileSettings>> =>
    api.put('/settings/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<void>> =>
    api.put('/settings/password', data),
  getInvoiceSettings: (): Promise<AxiosResponse<InvoiceSettings>> =>
    api.get('/settings/invoice'),
  updateInvoiceSettings: (data: Partial<InvoiceSettings>): Promise<AxiosResponse<InvoiceSettings>> =>
    api.put('/settings/invoice', data),
  getTemplates: (): Promise<AxiosResponse<Template[]>> =>
    api.get('/settings/templates'),
  createTemplate: (data: Omit<Template, 'id'>): Promise<AxiosResponse<Template>> =>
    api.post('/settings/templates', data),
  updateTemplate: (id: number, data: Partial<Template>): Promise<AxiosResponse<Template>> =>
    api.put(`/settings/templates/${id}`, data),
  deleteTemplate: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/settings/templates/${id}`),
};

export default api;
