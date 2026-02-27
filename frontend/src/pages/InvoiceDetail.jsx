import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { format } from "date-fns";
import PrintableInvoice from "../components/PrintableInvoice";
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiSend,
  FiCheckCircle,
  FiCopy,
  FiPrinter,
  FiDownload,
  FiPlus,
  FiMoreVertical,
  FiDollarSign,
  FiX,
} from "react-icons/fi";

// Currency formatter
const formatCurrency = (amount, currency = "GBP") => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency,
  }).format(amount || 0);
};

// Status badge classes
const getStatusBadgeClass = (status) => {
  const classes = {
    draft: "status-draft",
    sent: "status-sent",
    viewed: "status-viewed",
    paid: "status-paid",
    overdue: "status-overdue",
    cancelled: "status-cancelled",
  };
  return classes[status] || "badge-gray";
};

// Add Payment Modal
function AddPaymentModal({ isOpen, onClose, invoice, onSubmit }) {
  const [amount, setAmount] = useState(invoice?.balance_due || "");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference,
        notes,
      });
      onClose();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-lg font-semibold">Record Payment</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="input-group">
              <label className="label">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                placeholder="0.00"
                required
              />
              <p className="input-hint">
                Balance due:{" "}
                {formatCurrency(invoice?.balance_due, invoice?.currency)}
              </p>
            </div>
            <div className="input-group">
              <label className="label">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="input-group">
              <label className="label">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input"
              >
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="paypal">PayPal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="input-group">
              <label className="label">Reference / Transaction ID</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="input"
                placeholder="e.g., Check #1234"
              />
            </div>
            <div className="input-group">
              <label className="label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const printRef = useRef(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Fetch invoice
  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const response = await invoicesAPI.getById(id);
      return response.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data) => invoicesAPI.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["invoice", id]);
      queryClient.invalidateQueries(["invoices"]);
      toast.success("Invoice status updated");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to update status");
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: (data) => invoicesAPI.addPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["invoice", id]);
      queryClient.invalidateQueries(["invoices"]);
      toast.success("Payment recorded");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to record payment");
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId) => invoicesAPI.deletePayment(id, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries(["invoice", id]);
      queryClient.invalidateQueries(["invoices"]);
      toast.success("Payment deleted");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to delete payment");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => invoicesAPI.duplicate(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries(["invoices"]);
      toast.success("Invoice duplicated");
      navigate(`/invoices/${response.data.id}/edit`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to duplicate invoice");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => invoicesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["invoices"]);
      toast.success("Invoice deleted");
      navigate("/invoices");
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || "Failed to delete invoice");
    },
  });

  const handleMarkAsSent = () => {
    updateStatusMutation.mutate({ status: "sent" });
    setShowMenu(false);
  };

  const handleMarkAsPaid = () => {
    updateStatusMutation.mutate({ status: "paid" });
    setShowMenu(false);
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate();
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      deleteMutation.mutate();
    }
    setShowMenu(false);
  };

  const handleAddPayment = (data) => {
    return addPaymentMutation.mutateAsync(data);
  };

  const handleDeletePayment = (paymentId) => {
    if (window.confirm("Are you sure you want to delete this payment?")) {
      deletePaymentMutation.mutate(paymentId);
    }
  };

  const handlePrint = () => {
    // Close the menu first
    setShowMenu(false);

    // Use a slight delay to ensure menu is closed before printing
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    setShowMenu(false);

    // Dynamic import of html2canvas and jspdf for PDF generation
    try {
      toast.loading("Generating PDF...", { id: "pdf-generation" });

      // Try to dynamically import the PDF libraries
      let html2canvas, jsPDF;
      try {
        const [html2canvasModule, jspdfModule] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);
        html2canvas = html2canvasModule.default;
        jsPDF = jspdfModule.default;
      } catch (importError) {
        // Libraries not installed - fall back to print
        toast.dismiss("pdf-generation");
        toast(
          "PDF libraries not installed. Opening print dialog instead.\n\nTo enable PDF downloads, run: npm install html2canvas jspdf",
          { duration: 5000, icon: "ℹ️" },
        );
        setTimeout(() => window.print(), 100);
        return;
      }

      if (!printRef.current) {
        toast.error("Unable to generate PDF", { id: "pdf-generation" });
        return;
      }

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio,
      );
      pdf.save(`${invoice.invoice_number}.pdf`);

      toast.success("PDF downloaded!", { id: "pdf-generation" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF. Please try printing instead.", {
        id: "pdf-generation",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Invoice not found
        </h2>
        <p className="mt-2 text-gray-500">
          The invoice you're looking for doesn't exist or has been deleted.
        </p>
        <Link
          to="/invoices"
          className="btn-primary mt-4 inline-flex items-center gap-2"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
      </div>
    );
  }

  const canEdit = !["paid", "cancelled"].includes(invoice.status);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header - Hidden when printing */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/invoices"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {invoice.invoice_number}
              </h1>
              <span className={getStatusBadgeClass(invoice.status)}>
                {invoice.status.charAt(0).toUpperCase() +
                  invoice.status.slice(1)}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Created {format(new Date(invoice.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              to={`/invoices/${id}/edit`}
              className="btn-secondary flex items-center gap-2"
            >
              <FiEdit2 className="w-4 h-4" />
              Edit
            </Link>
          )}

          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <FiDollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}

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
                    onClick={handlePrint}
                    className="dropdown-item flex items-center gap-2"
                  >
                    <FiPrinter className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="dropdown-item flex items-center gap-2"
                  >
                    <FiDownload className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button
                    onClick={handleDuplicate}
                    className="dropdown-item flex items-center gap-2"
                  >
                    <FiCopy className="w-4 h-4" />
                    Duplicate
                  </button>
                  {invoice.status === "draft" && (
                    <button
                      onClick={handleMarkAsSent}
                      className="dropdown-item flex items-center gap-2"
                    >
                      <FiSend className="w-4 h-4" />
                      Mark as Sent
                    </button>
                  )}
                  {invoice.status !== "paid" &&
                    invoice.status !== "cancelled" && (
                      <button
                        onClick={handleMarkAsPaid}
                        className="dropdown-item flex items-center gap-2"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                        Mark as Paid
                      </button>
                    )}
                  <hr className="my-1" />
                  <button
                    onClick={handleDelete}
                    className="dropdown-item-danger flex items-center gap-2"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Printable Invoice Content */}
      <div className="invoice-print-container">
        <div className="card overflow-hidden">
          <PrintableInvoice ref={printRef} invoice={invoice} user={user} />
        </div>
      </div>

      {/* Payments Section - Hidden when printing */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="card mt-6 no-print">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Payment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th className="text-right">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {format(new Date(payment.payment_date), "MMM d, yyyy")}
                    </td>
                    <td className="capitalize">
                      {payment.payment_method?.replace("_", " ") || "-"}
                    </td>
                    <td>{payment.reference || "-"}</td>
                    <td className="text-gray-500">{payment.notes || "-"}</td>
                    <td className="text-right font-medium text-green-600">
                      {formatCurrency(payment.amount, invoice.currency)}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete payment"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <AddPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        invoice={invoice}
        onSubmit={handleAddPayment}
      />
    </div>
  );
}
