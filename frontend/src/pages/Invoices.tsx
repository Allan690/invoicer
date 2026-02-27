import { useState, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesAPI } from "../services/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiMoreVertical,
  FiEye,
  FiEdit2,
  FiCopy,
  FiTrash2,
  FiSend,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
} from "react-icons/fi";
import { InvoiceStatus, InvoicesResponse } from "../types";

interface StatusOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const getStatusBadgeClass = (status: InvoiceStatus | string): string => {
  const classes: Record<string, string> = {
    draft: "status-draft",
    sent: "status-sent",
    viewed: "status-viewed",
    paid: "status-paid",
    overdue: "status-overdue",
    cancelled: "status-cancelled",
  };
  return classes[status] || "badge-gray";
};

const formatCurrency = (
  amount: number | string | undefined,
  currency = "GBP",
): string => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(amount) || 0);
};

export default function Invoices(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const limit = 10;

  // Fetch invoices
  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices", { search, status, page, limit }],
    queryFn: () =>
      invoicesAPI.getAll({
        search: search || undefined,
        status: (status as InvoiceStatus) || undefined,
        page,
        limit,
      }),
    select: (response) => response.data as unknown as InvoicesResponse,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: InvoiceStatus }) =>
      invoicesAPI.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (id: number) => invoicesAPI.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice duplicated");
    },
    onError: () => {
      toast.error("Failed to duplicate invoice");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: () => {
      toast.error("Failed to delete invoice");
    },
  });

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setPage(1);
    setSearchParams({ search, status, page: "1" });
  };

  const handleStatusChange = (newStatus: string): void => {
    setStatus(newStatus);
    setPage(1);
    setSearchParams({ search, status: newStatus, page: "1" });
  };

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
    setSearchParams({ search, status, page: newPage.toString() });
  };

  const handleMarkAsSent = (id: number): void => {
    updateStatusMutation.mutate({ id, status: "sent" });
    setOpenMenuId(null);
  };

  const handleMarkAsPaid = (id: number): void => {
    updateStatusMutation.mutate({ id, status: "paid" });
    setOpenMenuId(null);
  };

  const handleDuplicate = (id: number): void => {
    duplicateMutation.mutate(id);
    setOpenMenuId(null);
  };

  const handleDelete = (id: number): void => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteMutation.mutate(id);
    }
    setOpenMenuId(null);
  };

  const invoices = data?.invoices || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage and track all your invoices</p>
        </div>
        <Link
          to="/invoices/new"
          className="btn-primary flex items-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by invoice number or client..."
                  className="input pl-10"
                />
              </div>
            </form>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <FiFilter className="text-gray-400 w-5 h-5" />
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="input w-auto"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="spinner spinner-lg mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading invoices...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-red-500">Failed to load invoices</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state py-16">
            <FiFileText className="empty-state-icon" />
            <h3 className="empty-state-title">No invoices found</h3>
            <p className="empty-state-description">
              {search || status
                ? "Try adjusting your search or filters"
                : "Get started by creating your first invoice"}
            </p>
            {!search && !status && (
              <Link to="/invoices/new" className="btn-primary mt-4">
                <FiPlus className="w-4 h-4 mr-2" />
                Create Invoice
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const invoiceNumber =
                      invoice.invoice_number || invoice.invoiceNumber;
                    const issueDate = invoice.issue_date || invoice.issueDate;
                    const dueDate = invoice.due_date || invoice.dueDate;
                    const balanceDue =
                      invoice.balance_due ?? invoice.balanceDue;

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
                        <td>
                          <div>
                            <p className="font-medium text-gray-900">
                              {invoice.client_company || invoice.client_name}
                            </p>
                            {invoice.client_company && (
                              <p className="text-xs text-gray-500">
                                {invoice.client_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-gray-500">
                          {issueDate
                            ? format(new Date(issueDate), "MMM d, yyyy")
                            : "-"}
                        </td>
                        <td className="text-gray-500">
                          {dueDate
                            ? format(new Date(dueDate), "MMM d, yyyy")
                            : "On receipt"}
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(invoice.status)}>
                            {invoice.status.charAt(0).toUpperCase() +
                              invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="text-right font-medium">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </td>
                        <td className="text-right">
                          {parseFloat(String(balanceDue || 0)) > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(balanceDue, invoice.currency)}
                            </span>
                          ) : (
                            <span className="text-green-600">Paid</span>
                          )}
                        </td>
                        <td>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === invoice.id ? null : invoice.id,
                                )
                              }
                              className="p-2 rounded-lg hover:bg-gray-100"
                            >
                              <FiMoreVertical className="w-4 h-4 text-gray-500" />
                            </button>

                            {openMenuId === invoice.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div className="dropdown-menu">
                                  <Link
                                    to={`/invoices/${invoice.id}`}
                                    className="dropdown-item flex items-center gap-2"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    <FiEye className="w-4 h-4" />
                                    View
                                  </Link>
                                  {invoice.status !== "paid" &&
                                    invoice.status !== "cancelled" && (
                                      <Link
                                        to={`/invoices/${invoice.id}/edit`}
                                        className="dropdown-item flex items-center gap-2"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <FiEdit2 className="w-4 h-4" />
                                        Edit
                                      </Link>
                                    )}
                                  <button
                                    onClick={() => handleDuplicate(invoice.id)}
                                    className="dropdown-item flex items-center gap-2"
                                  >
                                    <FiCopy className="w-4 h-4" />
                                    Duplicate
                                  </button>
                                  {invoice.status === "draft" && (
                                    <button
                                      onClick={() =>
                                        handleMarkAsSent(invoice.id)
                                      }
                                      className="dropdown-item flex items-center gap-2"
                                    >
                                      <FiSend className="w-4 h-4" />
                                      Mark as Sent
                                    </button>
                                  )}
                                  {invoice.status !== "paid" &&
                                    invoice.status !== "cancelled" && (
                                      <button
                                        onClick={() =>
                                          handleMarkAsPaid(invoice.id)
                                        }
                                        className="dropdown-item flex items-center gap-2"
                                      >
                                        <FiCheckCircle className="w-4 h-4" />
                                        Mark as Paid
                                      </button>
                                    )}
                                  <hr className="my-1" />
                                  <button
                                    onClick={() => handleDelete(invoice.id)}
                                    className="dropdown-item-danger flex items-center gap-2"
                                  >
                                    <FiTrash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} invoices
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="btn-secondary btn-sm"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="btn-secondary btn-sm"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
