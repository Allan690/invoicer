import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsAPI } from "../services/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiMail,
  FiPhone,
  FiMapPin,
  FiFileText,
  FiPlus,
  FiMoreVertical,
  FiBriefcase,
} from "react-icons/fi";
import { Invoice, InvoiceStatus } from "../types";

// Extended client type from API
interface ClientDetail {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  tax_number?: string;
  notes?: string;
  invoice_count?: string | number;
  total_billed?: string | number;
  total_outstanding?: string | number;
}

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

// Status badge classes
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

export default function ClientDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showMenu, setShowMenu] = useState(false);

  // Fetch client details
  const {
    data: client,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const response = await clientsAPI.getById(id!);
      return response.data as ClientDetail;
    },
    enabled: !!id,
  });

  // Fetch client invoices
  const { data: invoices } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => {
      const response = await clientsAPI.getInvoices(id!);
      return response.data as Invoice[];
    },
    enabled: !!id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => clientsAPI.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted successfully");
      navigate("/clients");
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Failed to delete client");
    },
  });

  const handleDelete = (): void => {
    if (
      window.confirm(
        "Are you sure you want to delete this client? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
    setShowMenu(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Client not found
        </h2>
        <p className="mt-2 text-gray-500">
          The client you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </p>
        <Link
          to="/clients"
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
      </div>
    );
  }

  const hasInvoices = parseInt(String(client.invoice_count || 0)) > 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/clients"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.company_name || client.name}
            </h1>
            {client.company_name && (
              <p className="text-sm text-gray-500">{client.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/clients/${id}/edit`}
            className="btn-secondary flex items-center gap-2"
          >
            <FiEdit2 className="w-4 h-4" />
            Edit
          </Link>

          <Link
            to={`/invoices/new?client=${id}`}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus className="w-4 h-4" />
            New Invoice
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="btn-secondary p-2"
            >
              <FiMoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="dropdown-menu z-50">
                  <button
                    onClick={handleDelete}
                    disabled={hasInvoices}
                    className={`dropdown-item flex items-center gap-2 w-full ${
                      hasInvoices
                        ? "text-gray-400 cursor-not-allowed"
                        : "dropdown-item-danger"
                    }`}
                    title={
                      hasInvoices ? "Cannot delete client with invoices" : ""
                    }
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Delete Client
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Details */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Contact Details</h2>
            </div>
            <div className="card-body space-y-4">
              {client.email && (
                <div className="flex items-start gap-3">
                  <FiMail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <a
                      href={`mailto:${client.email}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      {client.email}
                    </a>
                  </div>
                </div>
              )}

              {client.phone && (
                <div className="flex items-start gap-3">
                  <FiPhone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <a
                      href={`tel:${client.phone}`}
                      className="text-gray-900 hover:text-primary-600"
                    >
                      {client.phone}
                    </a>
                  </div>
                </div>
              )}

              {client.address && (
                <div className="flex items-start gap-3">
                  <FiMapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="text-gray-900 whitespace-pre-line">
                      {client.address}
                    </p>
                  </div>
                </div>
              )}

              {client.tax_number && (
                <div className="flex items-start gap-3">
                  <FiBriefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Tax Number</p>
                    <p className="text-gray-900">{client.tax_number}</p>
                  </div>
                </div>
              )}

              {!client.email && !client.phone && !client.address && (
                <p className="text-sm text-gray-500 italic">
                  No contact details provided
                </p>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Financial Summary</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Invoices</span>
                <span className="font-semibold">
                  {client.invoice_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Billed</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(client.total_billed)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Outstanding</span>
                <span
                  className={`font-semibold ${
                    parseFloat(String(client.total_outstanding || 0)) > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {formatCurrency(client.total_outstanding)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Notes</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {client.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Invoices List */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invoices</h2>
              <Link
                to={`/invoices/new?client=${id}`}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + New Invoice
              </Link>
            </div>

            {invoices && invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const invoiceNumber =
                        invoice.invoice_number || invoice.invoiceNumber;
                      const issueDate = invoice.issue_date || invoice.issueDate;
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
                          <td className="text-gray-500">
                            {issueDate
                              ? format(new Date(issueDate), "MMM d, yyyy")
                              : "-"}
                          </td>
                          <td>
                            <span
                              className={getStatusBadgeClass(invoice.status)}
                            >
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state py-12">
                <FiFileText className="empty-state-icon" />
                <h3 className="empty-state-title">No invoices yet</h3>
                <p className="empty-state-description">
                  Create your first invoice for this client.
                </p>
                <Link
                  to={`/invoices/new?client=${id}`}
                  className="btn-primary mt-4 inline-flex items-center gap-2"
                >
                  <FiPlus className="w-4 h-4" />
                  Create Invoice
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
