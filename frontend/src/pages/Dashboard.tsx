import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dashboardAPI } from "../services/api";
import { format } from "date-fns";
import {
  FiDollarSign,
  FiClock,
  FiAlertCircle,
  FiUsers,
  FiFileText,
  FiArrowRight,
  FiPlus,
} from "react-icons/fi";
import { Invoice } from "../types";

// Currency formatter
const formatCurrency = (
  amount: number | string | undefined,
  currency = "GBP",
): string => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(Number(amount) || 0);
};

// Types for dashboard data
interface DashboardStats {
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  clientCount: number;
  overdueCount: number;
  monthRevenue: number;
  yearRevenue: number;
  invoicesByStatus: Record<string, { count: number; totalAmount: number }>;
  recentInvoices: Invoice[];
}

interface MonthlyRevenueData {
  month: number;
  monthName: string;
  revenue: number;
}

interface MonthlyRevenueResponse {
  year: number;
  data: MonthlyRevenueData[];
  totals: {
    revenue: number;
  };
}

interface OverdueInvoice extends Invoice {
  daysOverdue: number;
  balanceDue: number;
}

interface OverdueData {
  invoices: OverdueInvoice[];
}

// Status badge component
interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps): React.JSX.Element => {
  const statusClasses: Record<string, string> = {
    draft: "badge-gray",
    sent: "badge-blue",
    viewed: "badge-purple",
    paid: "badge-green",
    overdue: "badge-red",
    cancelled: "badge-gray",
  };

  return (
    <span className={`badge ${statusClasses[status] || "badge-gray"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
  trendValue?: string;
  color?: "primary" | "green" | "yellow" | "red" | "blue";
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = "primary",
}: StatCardProps): React.JSX.Element => {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary-100 text-primary-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-yellow-100 text-yellow-600",
    red: "bg-red-100 text-red-600",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p
              className={`mt-1 text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}
            >
              {trend === "up" ? "↑" : "↓"} {trendValue}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

// Recent Invoice Row Component
interface RecentInvoiceRowProps {
  invoice: Invoice;
}

const RecentInvoiceRow = ({
  invoice,
}: RecentInvoiceRowProps): React.JSX.Element => {
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const clientName = invoice.client_name || invoice.clientName;
  const clientCompany = invoice.client_company || invoice.clientCompany;

  return (
    <Link
      to={`/invoices/${invoice.id}`}
      className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <FiFileText className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{invoiceNumber}</p>
          <p className="text-xs text-gray-500">{clientName || clientCompany}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">
          {formatCurrency(invoice.total)}
        </p>
        <StatusBadge status={invoice.status} />
      </div>
    </Link>
  );
};

// Simple Bar Chart Component
interface SimpleBarChartProps {
  data: MonthlyRevenueData[];
}

const SimpleBarChart = ({
  data,
}: SimpleBarChartProps): React.JSX.Element | null => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-40">
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div
            className="w-full bg-primary-500 rounded-t-sm transition-all duration-300 hover:bg-primary-600"
            style={{
              height: `${Math.max((item.revenue / maxValue) * 100, 2)}%`,
              minHeight: item.revenue > 0 ? "8px" : "2px",
            }}
            title={`${item.monthName}: ${formatCurrency(item.revenue)}`}
          />
          <span className="text-xs text-gray-500 mt-2">{item.monthName}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard(): React.JSX.Element {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const response = await dashboardAPI.getStats();
      return response.data as unknown as DashboardStats;
    },
  });

  // Fetch monthly revenue
  const { data: monthlyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard", "monthly-revenue"],
    queryFn: async () => {
      const response = await dashboardAPI.getMonthlyRevenue();
      return response.data as unknown as MonthlyRevenueResponse;
    },
  });

  // Fetch overdue invoices
  const { data: overdueData } = useQuery({
    queryKey: ["dashboard", "overdue"],
    queryFn: async () => {
      const response = await dashboardAPI.getOverdue();
      return { invoices: response.data } as OverdueData;
    },
  });

  const isLoading = statsLoading || revenueLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-4 w-48 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="skeleton h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back! Here&apos;s an overview of your business.
          </p>
        </div>
        <Link
          to="/invoices/new"
          className="btn-primary flex items-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={FiDollarSign}
          color="green"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats?.totalOutstanding || 0)}
          icon={FiClock}
          color="yellow"
        />
        <StatCard
          title="Overdue"
          value={formatCurrency(stats?.totalOverdue || 0)}
          icon={FiAlertCircle}
          color="red"
        />
        <StatCard
          title="Active Clients"
          value={stats?.clientCount || 0}
          icon={FiUsers}
          color="blue"
        />
      </div>

      {/* Overdue Warning */}
      {stats?.overdueCount && stats.overdueCount > 0 && (
        <div className="alert-warning flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FiAlertCircle className="h-5 w-5" />
            <span>
              You have <strong>{stats.overdueCount}</strong> overdue invoice(s)
              totaling <strong>{formatCurrency(stats.totalOverdue)}</strong>
            </span>
          </div>
          <Link to="/invoices?status=overdue" className="btn-sm btn-secondary">
            View All
          </Link>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Revenue Overview
              </h2>
              <p className="text-sm text-gray-500">
                Monthly revenue for{" "}
                {monthlyRevenue?.year || new Date().getFullYear()}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Total:</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(monthlyRevenue?.totals?.revenue || 0)}
              </span>
            </div>
          </div>
          <div className="card-body">
            {monthlyRevenue?.data ? (
              <SimpleBarChart data={monthlyRevenue.data} />
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-500">
                No revenue data available
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">This Month</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Revenue</span>
              <span className="text-lg font-semibold text-green-600">
                {formatCurrency(stats?.monthRevenue || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Year to Date</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(stats?.yearRevenue || 0)}
              </span>
            </div>
            <div className="divider" />
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                Invoice Status
              </h3>
              {stats?.invoicesByStatus &&
                Object.entries(stats.invoicesByStatus).map(([status, data]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <StatusBadge status={status} />
                    <span className="text-sm text-gray-600">
                      {data.count} ({formatCurrency(data.totalAmount)})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Invoices
          </h2>
          <Link
            to="/invoices"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            View All
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="card-body p-2">
          {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {stats.recentInvoices.map((invoice) => (
                <RecentInvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : (
            <div className="empty-state py-8">
              <FiFileText className="empty-state-icon" />
              <h3 className="empty-state-title">No invoices yet</h3>
              <p className="empty-state-description">
                Create your first invoice to get started tracking your income.
              </p>
              <Link to="/invoices/new" className="btn-primary mt-4">
                <FiPlus className="w-4 h-4 mr-2" />
                Create Invoice
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Overdue Invoices Table */}
      {overdueData?.invoices && overdueData.invoices.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between bg-red-50 border-red-100">
            <div className="flex items-center gap-2">
              <FiAlertCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">
                Overdue Invoices
              </h2>
            </div>
            <span className="badge badge-red">
              {overdueData.invoices.length} overdue
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th className="text-right">Amount Due</th>
                </tr>
              </thead>
              <tbody>
                {overdueData.invoices.map((invoice) => {
                  const invoiceNumber =
                    invoice.invoice_number || invoice.invoiceNumber;
                  const clientName = invoice.client_name || invoice.clientName;
                  const clientCompany =
                    invoice.client_company || invoice.clientCompany;
                  const dueDate = invoice.due_date || invoice.dueDate;

                  return (
                    <tr key={invoice.id}>
                      <td>
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="font-medium text-primary-600 hover:text-primary-700"
                        >
                          {invoiceNumber}
                        </Link>
                      </td>
                      <td>{clientName || clientCompany}</td>
                      <td>
                        {dueDate
                          ? format(new Date(dueDate), "MMM d, yyyy")
                          : "-"}
                      </td>
                      <td>
                        <span className="text-red-600 font-medium">
                          {invoice.daysOverdue} days
                        </span>
                      </td>
                      <td className="text-right font-semibold">
                        {formatCurrency(invoice.balanceDue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
