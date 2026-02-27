import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsAPI } from "../services/api";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiSave,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiBriefcase,
  FiFileText,
} from "react-icons/fi";
import { Client, ClientFormData } from "../types";

interface FormData {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  address: string;
  tax_number: string;
  notes: string;
}

interface FormErrors {
  name?: string;
  email?: string;
}

interface ExistingClient extends Client {
  company_name?: string;
  tax_number?: string;
}

export default function ClientForm(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    address: "",
    tax_number: "",
    notes: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch existing client if editing
  const { data: existingClient, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", id],
    queryFn: () => clientsAPI.getById(id!),
    enabled: isEditing,
    select: (response) => response.data as ExistingClient,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingClient) {
      setFormData({
        name: existingClient.name || "",
        email: existingClient.email || "",
        phone: existingClient.phone || "",
        company_name: existingClient.company_name || "",
        address: existingClient.address || "",
        tax_number: existingClient.tax_number || "",
        notes: existingClient.notes || "",
      });
    }
  }, [existingClient]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => clientsAPI.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created successfully");
      navigate(`/clients/${response.data.id}`);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "Failed to create client");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<ClientFormData>) => clientsAPI.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      toast.success("Client updated successfully");
      navigate(`/clients/${id}`);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "Failed to update client");
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Handle form field changes
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Client name is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
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

    const data: ClientFormData = {
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      company_name: formData.company_name || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isEditing && isLoadingClient) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="page-header flex items-center gap-4 mb-6">
        <Link
          to={isEditing ? `/clients/${id}` : "/clients"}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title">
            {isEditing ? "Edit Client" : "Add New Client"}
          </h1>
          {isEditing && existingClient && (
            <p className="page-subtitle">
              {existingClient.company_name || existingClient.name}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Basic Information</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Name */}
            <div className="input-group">
              <label htmlFor="name" className="label">
                Contact Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.name ? "input-error" : ""}`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && (
                <p className="input-error-message">{errors.name}</p>
              )}
            </div>

            {/* Company Name */}
            <div className="input-group">
              <label htmlFor="company_name" className="label">
                Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiBriefcase className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="Acme Inc."
                />
              </div>
            </div>

            {/* Email */}
            <div className="input-group">
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.email ? "input-error" : ""}`}
                  placeholder="john@example.com"
                />
              </div>
              {errors.email && (
                <p className="input-error-message">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="input-group">
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiPhone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="+44 1234 567890"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Additional Information</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Address */}
            <div className="input-group">
              <label htmlFor="address" className="label">
                Address
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FiMapPin className="h-5 w-5 text-gray-400" />
                </div>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="input pl-10"
                  placeholder="123 Main Street&#10;London, UK&#10;EC1A 1BB"
                />
              </div>
            </div>

            {/* Tax Number */}
            <div className="input-group">
              <label htmlFor="tax_number" className="label">
                Tax/VAT Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiFileText className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="tax_number"
                  name="tax_number"
                  value={formData.tax_number}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="GB123456789"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="input-group">
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
                placeholder="Additional notes about this client..."
              />
              <p className="input-hint">
                Internal notes, not visible to the client
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            to={isEditing ? `/clients/${id}` : "/clients"}
            className="btn-secondary"
          >
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
                {isEditing ? "Update Client" : "Create Client"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
