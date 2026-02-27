import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesAPI, clientsAPI } from "../services/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { FiPlus, FiTrash2, FiSave, FiArrowLeft } from "react-icons/fi";
import {
  Invoice,
  InvoiceFormData,
  ClientWithStats,
  ClientsResponse,
  AxiosErrorResponse,
} from "../types";

interface FormItem {
  description: string;
  quantity: number;
  rate: number;
}

interface FormState {
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
  items: FormItem[];
}

interface FormErrors {
  client_id?: string;
  issue_date?: string;
  items?: string;
  [key: string]: string | undefined;
}

const CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
];

const DUE_TERMS = [
  { value: "on_receipt", label: "On Receipt" },
  { value: "net_7", label: "Net 7 days" },
  { value: "net_14", label: "Net 14 days" },
  { value: "net_30", label: "Net 30 days" },
  { value: "net_60", label: "Net 60 days" },
  { value: "custom", label: "Custom Date" },
];

const calculateDueDate = (
  issueDate: string | undefined,
  terms: string,
): string | null => {
  if (!issueDate || terms === "on_receipt" || terms === "custom") return null;

  const date = new Date(issueDate);
  const termParts = terms.split("_");
  const daysPart = termParts[1];
  const days = daysPart ? parseInt(daysPart, 10) || 0 : 0;
  date.setDate(date.getDate() + days);
  return format(date, "yyyy-MM-dd");
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

export default function InvoiceForm(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<FormState>({
    client_id: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "",
    due_terms: "on_receipt",
    currency: "GBP",
    tax_rate: 0,
    discount_type: "",
    discount_value: 0,
    notes: "",
    terms: "",
    items: [{ description: "", quantity: 1, rate: 0 }],
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch clients for dropdown
  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsAPI.getAll({ limit: 100 }),
    select: (response) =>
      (response.data as unknown as ClientsResponse).clients ||
      (response.data as unknown as { data: ClientWithStats[] }).data ||
      [],
  });

  // Fetch existing invoice if editing
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => {
      if (!id) throw new Error("Invoice ID is required");
      return invoicesAPI.getById(id);
    },
    enabled: isEditing && !!id,
    select: (response) => response.data,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingInvoice) {
      const invoice = existingInvoice as Invoice;
      const clientId = invoice.client_id ?? invoice.clientId;
      const issueDate = invoice.issue_date ?? invoice.issueDate;
      const dueDate = invoice.due_date ?? invoice.dueDate;
      const dueTerms = invoice.due_terms ?? invoice.dueTerms;
      const taxRate = invoice.tax_rate ?? invoice.taxRate;
      const discountType = invoice.discount_type ?? invoice.discountType;
      const discountValue = invoice.discount_value ?? invoice.discountValue;

      setFormData({
        client_id: String(clientId || ""),
        issue_date: issueDate?.split("T")[0] || "",
        due_date: dueDate?.split("T")[0] || "",
        due_terms: dueTerms || "on_receipt",
        currency: invoice.currency || "GBP",
        tax_rate: taxRate || 0,
        discount_type: discountType || "",
        discount_value: discountValue || 0,
        notes: invoice.notes || "",
        terms: invoice.terms || "",
        items:
          invoice.items && invoice.items.length > 0
            ? invoice.items.map((item) => ({
                description: item.description,
                quantity: Number(item.quantity),
                rate: Number(item.rate),
              }))
            : [{ description: "", quantity: 1, rate: 0 }],
      });
    }
  }, [existingInvoice]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: InvoiceFormData) => invoicesAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created successfully");
      navigate(`/invoices/${response.data.id}`);
    },
    onError: (error: AxiosErrorResponse) => {
      toast.error(error.response?.data?.message || "Failed to create invoice");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: InvoiceFormData) => {
      if (!id) throw new Error("Invoice ID is required");
      return invoicesAPI.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Invoice updated successfully");
      navigate(`/invoices/${id}`);
    },
    onError: (error: AxiosErrorResponse) => {
      toast.error(error.response?.data?.message || "Failed to update invoice");
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Handle form field changes
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-calculate due date when terms change
      if (name === "due_terms" && value !== "custom") {
        updated.due_date = calculateDueDate(prev.issue_date, value) || "";
      }

      // Recalculate due date when issue date changes
      if (name === "issue_date" && prev.due_terms !== "custom") {
        updated.due_date = calculateDueDate(value, prev.due_terms) || "";
      }

      return updated;
    });

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Handle line item changes
  const handleItemChange = (
    index: number,
    field: keyof FormItem,
    value: string | number,
  ): void => {
    setFormData((prev) => {
      const items = [...prev.items];
      const currentItem = items[index];
      if (!currentItem) return prev;

      const updatedItem: FormItem = {
        description: currentItem.description,
        quantity: currentItem.quantity,
        rate: currentItem.rate,
      };
      if (field === "description") {
        updatedItem.description = String(value);
      } else if (field === "quantity") {
        updatedItem.quantity = Number(value) || 0;
      } else if (field === "rate") {
        updatedItem.rate = Number(value) || 0;
      }
      items[index] = updatedItem;
      return { ...prev, items };
    });
  };

  // Add new line item
  const addItem = (): void => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, rate: 0 }],
    }));
  };

  // Remove line item
  const removeItem = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals
  const calculateTotals = (): {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
  } => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    }, 0);

    let discountAmount = 0;
    if (formData.discount_type === "percentage") {
      discountAmount =
        subtotal * ((Number(formData.discount_value) || 0) / 100);
    } else if (formData.discount_type === "fixed") {
      discountAmount = Number(formData.discount_value) || 0;
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((Number(formData.tax_rate) || 0) / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.client_id) {
      newErrors.client_id = "Please select a client";
    }

    if (!formData.issue_date) {
      newErrors.issue_date = "Issue date is required";
    }

    const validItems = formData.items.filter(
      (item) => item.description.trim() && Number(item.rate) > 0,
    );

    if (validItems.length === 0) {
      newErrors.items = "At least one line item is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    // Filter out empty items
    const validItems = formData.items.filter(
      (item) => item.description.trim() && Number(item.rate) > 0,
    );

    const data: InvoiceFormData = {
      client_id: formData.client_id,
      issue_date: formData.issue_date,
      due_date: formData.due_date || undefined,
      due_terms: formData.due_terms,
      currency: formData.currency,
      items: validItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
      tax_rate: Number(formData.tax_rate) || 0,
      discount_value: Number(formData.discount_value) || 0,
      discount_type: formData.discount_type || null,
      notes: formData.notes || undefined,
      terms: formData.terms || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isEditing && isLoadingInvoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  const clients: ClientWithStats[] = clientsData || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/invoices"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">
              {isEditing ? "Edit Invoice" : "Create Invoice"}
            </h1>
            {isEditing && existingInvoice && (
              <p className="page-subtitle">
                {(existingInvoice as Invoice).invoice_number ||
                  (existingInvoice as Invoice).invoiceNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Basic Info */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Invoice Details</h2>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client */}
            <div className="md:col-span-2">
              <label htmlFor="client_id" className="label">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="client_id"
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                className={`input ${errors.client_id ? "input-error" : ""}`}
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.companyName || client.name}{" "}
                    {(client.company_name || client.companyName) &&
                      `(${client.name})`}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="input-error-message">{errors.client_id}</p>
              )}
              <Link
                to="/clients/new"
                className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block"
              >
                + Add new client
              </Link>
            </div>

            {/* Issue Date */}
            <div>
              <label htmlFor="issue_date" className="label">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="issue_date"
                name="issue_date"
                value={formData.issue_date}
                onChange={handleChange}
                className={`input ${errors.issue_date ? "input-error" : ""}`}
              />
              {errors.issue_date && (
                <p className="input-error-message">{errors.issue_date}</p>
              )}
            </div>

            {/* Due Terms */}
            <div>
              <label htmlFor="due_terms" className="label">
                Payment Terms
              </label>
              <select
                id="due_terms"
                name="due_terms"
                value={formData.due_terms}
                onChange={handleChange}
                className="input"
              >
                {DUE_TERMS.map((term) => (
                  <option key={term.value} value={term.value}>
                    {term.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date (shown only for custom) */}
            {formData.due_terms === "custom" && (
              <div>
                <label htmlFor="due_date" className="label">
                  Due Date
                </label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            )}

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="label">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="input"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol}) - {currency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary btn-sm flex items-center gap-1"
            >
              <FiPlus className="w-4 h-4" />
              Add Item
            </button>
          </div>
          <div className="card-body">
            {errors.items && (
              <div className="alert-error mb-4">{errors.items}</div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">
                      Description
                    </th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-24">
                      Qty
                    </th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-32">
                      Rate
                    </th>
                    <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 w-32">
                      Amount
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => {
                    const amount =
                      (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                    return (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            placeholder="Item description"
                            className="input"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            min="0"
                            step="0.01"
                            className="input text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) =>
                              handleItemChange(index, "rate", e.target.value)
                            }
                            min="0"
                            step="0.01"
                            className="input text-right"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-gray-900">
                          {formatCurrency(amount, formData.currency)}
                        </td>
                        <td className="py-2 px-2">
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Discounts, Tax & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Discount & Tax */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Adjustments</h2>
            </div>
            <div className="card-body space-y-4">
              {/* Discount Type */}
              <div>
                <label htmlFor="discount_type" className="label">
                  Discount
                </label>
                <div className="flex gap-2">
                  <select
                    id="discount_type"
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleChange}
                    className="input w-1/2"
                  >
                    <option value="">No discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                  {formData.discount_type && (
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="input w-1/2"
                      placeholder={
                        formData.discount_type === "percentage" ? "%" : "Amount"
                      }
                    />
                  )}
                </div>
              </div>

              {/* Tax Rate */}
              <div>
                <label htmlFor="tax_rate" className="label">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  id="tax_rate"
                  name="tax_rate"
                  value={formData.tax_rate}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className="input"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Summary</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(subtotal, formData.currency)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(discountAmount, formData.currency)}
                  </span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Tax ({formData.tax_rate}%)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(taxAmount, formData.currency)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">
                    Total
                  </span>
                  <span className="text-lg font-bold text-primary-600">
                    {formatCurrency(total, formData.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Additional Information</h2>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="notes" className="label">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="input"
                placeholder="Notes to the client (optional)"
              />
            </div>
            <div>
              <label htmlFor="terms" className="label">
                Terms & Conditions
              </label>
              <textarea
                id="terms"
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                rows={4}
                className="input"
                placeholder="Payment terms and conditions (optional)"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4">
          <Link to="/invoices" className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="spinner spinner-sm"></div>
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4" />
                {isEditing ? "Update Invoice" : "Create Invoice"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
