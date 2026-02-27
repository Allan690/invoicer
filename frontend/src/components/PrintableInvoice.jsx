import { forwardRef } from "react";
import { format } from "date-fns";

const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount || 0);
};

const PrintableInvoice = forwardRef(({ invoice, user }, ref) => {
  if (!invoice) return null;

  return (
    <div
      ref={ref}
      className="printable-invoice bg-white p-8 max-w-4xl mx-auto"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* Invoice Header */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {user?.businessName || user?.fullName || "Your Business"}
          </h2>
          {user?.address && (
            <p className="text-sm text-gray-600 whitespace-pre-line mt-2 max-w-xs">
              {user.address}
            </p>
          )}
          {user?.email && (
            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
          )}
          {user?.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
        </div>
        <div className="text-right">
          <h1 className="text-4xl font-bold text-gray-300 uppercase tracking-wider">
            Invoice
          </h1>
          <p className="text-xl font-semibold text-gray-900 mt-2">
            {invoice.invoice_number}
          </p>
        </div>
      </div>

      {/* Bill To & Invoice Details */}
      <div className="flex justify-between mb-8">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Bill To
          </h3>
          <p className="font-semibold text-gray-900 text-lg">
            {invoice.client_company || invoice.client_name}
          </p>
          {invoice.client_company && invoice.client_name && (
            <p className="text-sm text-gray-600">{invoice.client_name}</p>
          )}
          {invoice.client_email && (
            <p className="text-sm text-gray-600">{invoice.client_email}</p>
          )}
          {invoice.client_address && (
            <p className="text-sm text-gray-600 whitespace-pre-line mt-1">
              {invoice.client_address}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="space-y-1">
            <div className="flex justify-between gap-8">
              <span className="text-sm text-gray-500">Issue Date:</span>
              <span className="text-sm font-medium text-gray-900">
                {format(new Date(invoice.issue_date), "MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-sm text-gray-500">Due Date:</span>
              <span className="text-sm font-medium text-gray-900">
                {invoice.due_date
                  ? format(new Date(invoice.due_date), "MMMM d, yyyy")
                  : "On Receipt"}
              </span>
            </div>
            <div className="flex justify-between gap-8 pt-2 mt-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-700">
                Balance Due:
              </span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(invoice.balance_due, invoice.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="mb-8">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 w-24">
                Rate
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 w-20">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 w-28">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items?.map((item, index) => (
              <tr key={item.id || index}>
                <td className="px-4 py-4 text-sm text-gray-900">
                  {item.description}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 text-right">
                  {formatCurrency(item.rate, invoice.currency)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 text-right">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                  {formatCurrency(item.amount, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </span>
            </div>
            {parseFloat(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Discount
                  {invoice.discount_type === "percentage" &&
                    ` (${invoice.discount_value}%)`}
                </span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(invoice.discount_amount, invoice.currency)}
                </span>
              </div>
            )}
            {parseFloat(invoice.tax_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.tax_amount, invoice.currency)}
                </span>
              </div>
            )}
            <div className="border-t-2 border-gray-200 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-xl text-gray-900">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
            </div>
            {parseFloat(invoice.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span className="font-medium">
                    -{formatCurrency(invoice.amount_paid, invoice.currency)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">
                      Balance Due
                    </span>
                    <span className="font-bold text-xl text-gray-900">
                      {formatCurrency(invoice.balance_due, invoice.currency)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(invoice.notes || invoice.terms) && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {invoice.notes && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Terms & Conditions
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {invoice.terms}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-500">Thank you for your business!</p>
      </div>
    </div>
  );
});

PrintableInvoice.displayName = "PrintableInvoice";

export default PrintableInvoice;
