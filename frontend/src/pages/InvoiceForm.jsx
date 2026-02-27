import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesAPI, clientsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  FiPlus,
  FiTrash2,
  FiSave,
  FiArrowLeft,
  FiDollarSign,
  FiPercent,
} from 'react-icons/fi';

const CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
];

const DUE_TERMS = [
  { value: 'on_receipt', label: 'On Receipt' },
  { value: 'net_7', label: 'Net 7 days' },
  { value: 'net_14', label: 'Net 14 days' },
  { value: 'net_30', label: 'Net 30 days' },
  { value: 'net_60', label: 'Net 60 days' },
  { value: 'custom', label: 'Custom Date' },
];

const calculateDueDate = (issueDate, terms) => {
  if (!issueDate || terms === 'on_receipt' || terms === 'custom') return null;

  const date = new Date(issueDate);
  const days = parseInt(terms.split('_')[1]) || 0;
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
};

const formatCurrency = (amount, currency = 'GBP') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount || 0);
};

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    client_id: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '',
    due_terms: 'on_receipt',
    currency: 'GBP',
    tax_rate: 0,
    discount_type: '',
    discount_value: 0,
    notes: '',
    terms: '',
    items: [{ description: '', quantity: 1, rate: 0 }],
  });

  const [errors, setErrors] = useState({});

  // Fetch clients for dropdown
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsAPI.getAll({ limit: 100 }),
    select: (response) => response.data.clients,
  });

  // Fetch existing invoice if editing
  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesAPI.getById(id),
    enabled: isEditing,
    select: (response) => response.data,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingInvoice) {
      setFormData({
        client_id: existingInvoice.client_id,
        issue_date: existingInvoice.issue_date?.split('T')[0] || '',
        due_date: existingInvoice.due_date?.split('T')[0] || '',
        due_terms: existingInvoice.due_terms || 'on_receipt',
        currency: existingInvoice.currency || 'GBP',
        tax_rate: existingInvoice.tax_rate || 0,
        discount_type: existingInvoice.discount_type || '',
        discount_value: existingInvoice.discount_value || 0,
        notes: existingInvoice.notes || '',
        terms: existingInvoice.terms || '',
        items: existingInvoice.items?.length > 0
          ? existingInvoice.items.map(item => ({
              description: item.description,
              quantity: parseFloat(item.quantity),
              rate: parseFloat(item.rate),
            }))
          : [{ description: '', quantity: 1, rate: 0 }],
      });
    }
  }, [existingInvoice]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => invoicesAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['invoices']);
      toast.success('Invoice created successfully');
      navigate(`/invoices/${response.data.id}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create invoice');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data) => invoicesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices']);
      queryClient.invalidateQueries(['invoice', id]);
      toast.success('Invoice updated successfully');
      navigate(`/invoices/${id}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update invoice');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-calculate due date when terms change
      if (name === 'due_terms' && value !== 'custom') {
        updated.due_date = calculateDueDate(prev.issue_date, value) || '';
      }

      // Recalculate due date when issue date changes
      if (name === 'issue_date' && prev.due_terms !== 'custom') {
        updated.due_date = calculateDueDate(value, prev.due_terms) || '';
      }

      return updated;
    });

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle line item changes
  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  // Add new line item
  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0 }],
    }));
  };

  // Remove line item
  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    }, 0);

    let discountAmount = 0;
    if (formData.discount_type === 'percentage') {
      discountAmount = subtotal * ((parseFloat(formData.discount_value) || 0) / 100);
    } else if (formData.discount_type === 'fixed') {
      discountAmount = parseFloat(formData.discount_value) || 0;
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((parseFloat(formData.tax_rate) || 0) / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.client_id) {
      newErrors.client_id = 'Please select a client';
    }

    if (!formData.issue_date) {
      newErrors.issue_date = 'Issue date is required';
    }

    const validItems = formData.items.filter(
      (item) => item.description.trim() && parseFloat(item.rate) > 0
    );

    if (validItems.length === 0) {
      newErrors.items = 'At least one line item is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    // Filter out empty items
    const validItems = formData.items.filter(
      (item) => item.description.trim() && parseFloat(item.rate) > 0
    );

    const data = {
      ...formData,
      items: validItems,
      tax_rate: parseFloat(formData.tax_rate) || 0,
      discount_value: parseFloat(formData.discount_value) || 0,
      discount_type: formData.discount_type || null,
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

  const clients = clientsData || [];

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
              {isEditing ? 'Edit Invoice' : 'Create Invoice'}
            </h1>
            {isEditing && existingInvoice && (
              <p className="page-subtitle">{existingInvoice.invoice_number}</p>
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
                className={`input ${errors.client_id ? 'input-error' : ''}`}
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.name} {client.company_name ? `(${client.name})` : ''}
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
                className={`input ${errors.issue_date ? 'input-error' : ''}`}
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
            {formData.due_terms === 'custom' && (
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
                    const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                    return (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(index, 'description', e.target.value)
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
                              handleItemChange(index, 'quantity', e.target.value)
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
                              handleItemChange(index, 'rate', e.target.value)
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

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(subtotal, formData.currency)}
                  </span>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2">
                  <select
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleChange}
                    className="input py-1 text-sm flex-1"
                  >
                    <option value="">No discount</option>
                    <option value="percentage">Discount %</option>
                    <option value="fixed">Discount (fixed)</option>
                  </select>
                  {formData.discount_type && (
                    <div className="relative w-24">
                      <input
                        type="number"
                        name="discount_value"
                        value={formData.discount_value}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        className="input py-1 text-sm text-right pr-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {formData.discount_type === 'percentage' ? (
                          <FiPercent className="w-4 h-4" />
                        ) : (
                          <FiDollarSign className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmount, formData.currency)}</span>
                  </div>
                )}

                {/* Tax */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 flex-1">Tax Rate</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      name="tax_rate"
                      value={formData.tax_rate}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="input py-1 text-sm text-right pr-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      <FiPercent className="w-4 h-4" />
                    </span>
                  </div>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span>{formatCurrency(taxAmount, formData.currency)}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-lg font-bold text-gray-900">
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
                placeholder="Notes visible to the client..."
                className="input"
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
                placeholder="Payment terms, late fees, etc..."
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
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
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4" />
                {isEditing ? 'Update Invoice' : 'Create Invoice'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
