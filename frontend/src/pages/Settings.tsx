import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  FiUser,
  FiBriefcase,
  FiMapPin,
  FiPhone,
  FiDollarSign,
  FiFileText,
  FiLock,
  FiSave,
  FiHash,
} from "react-icons/fi";
import {
  ProfileSettings,
  InvoiceSettings,
  User,
  AxiosErrorResponse,
} from "../types";

const CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

// Form data types
interface ProfileFormData {
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

interface InvoiceSettingsFormData {
  prefix: string;
  padding: number;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  [key: string]: string | undefined;
}

// Profile Tab Component
function ProfileTab(): JSX.Element {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: async () => {
      const response = await settingsAPI.getProfile();
      return response.data;
    },
  });

  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: "",
    businessName: "",
    address: "",
    phone: "",
    defaultCurrency: "GBP",
    taxNumber: "",
    bankName: "",
    bankAccountNumber: "",
    bankSortCode: "",
  });
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      const p = profile as ProfileSettings;
      setFormData({
        fullName: p.fullName || p.full_name || "",
        businessName: p.businessName || p.business_name || "",
        address: p.address || "",
        phone: p.phone || "",
        defaultCurrency: p.defaultCurrency || p.default_currency || "GBP",
        taxNumber: p.taxNumber || p.tax_number || "",
        bankName: p.bankName || p.bank_name || "",
        bankAccountNumber: p.bankAccountNumber || p.bank_account_number || "",
        bankSortCode: p.bankSortCode || p.bank_sort_code || "",
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProfileSettings>) =>
      settingsAPI.updateProfile(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
      const responseData = response.data as ProfileSettings & { user?: User };
      if (responseData.user) {
        updateUser(responseData.user);
      }
      toast.success("Profile updated successfully");
      setIsDirty(false);
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    updateMutation.mutate(formData as unknown as Partial<ProfileSettings>);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Personal Information</h2>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="input-group">
            <label className="label">
              <FiUser className="inline w-4 h-4 mr-1" />
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="input"
              placeholder="Your full name"
            />
          </div>
          <div className="input-group">
            <label className="label">
              <FiBriefcase className="inline w-4 h-4 mr-1" />
              Business Name
            </label>
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              className="input"
              placeholder="Your business name (optional)"
            />
          </div>
          <div className="input-group md:col-span-2">
            <label className="label">
              <FiMapPin className="inline w-4 h-4 mr-1" />
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="input"
              rows={3}
              placeholder="Your business address"
            />
          </div>
          <div className="input-group">
            <label className="label">
              <FiPhone className="inline w-4 h-4 mr-1" />
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input"
              placeholder="+1 234 567 8900"
            />
          </div>
          <div className="input-group">
            <label className="label">
              <FiDollarSign className="inline w-4 h-4 mr-1" />
              Default Currency
            </label>
            <select
              name="defaultCurrency"
              value={formData.defaultCurrency}
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
          <div className="input-group">
            <label className="label">Tax Number (VAT/GST)</label>
            <input
              type="text"
              name="taxNumber"
              value={formData.taxNumber}
              onChange={handleChange}
              className="input"
              placeholder="Your tax ID"
            />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Bank Details</h2>
          <p className="text-sm text-gray-500">
            Displayed on invoices for payment instructions
          </p>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="input-group">
            <label className="label">Bank Name</label>
            <input
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              className="input"
              placeholder="Your bank name"
            />
          </div>
          <div className="input-group">
            <label className="label">Account Number</label>
            <input
              type="text"
              name="bankAccountNumber"
              value={formData.bankAccountNumber}
              onChange={handleChange}
              className="input"
              placeholder="12345678"
            />
          </div>
          <div className="input-group">
            <label className="label">Sort Code / Routing Number</label>
            <input
              type="text"
              name="bankSortCode"
              value={formData.bankSortCode}
              onChange={handleChange}
              className="input"
              placeholder="12-34-56"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {updateMutation.isPending ? (
            <>
              <div className="spinner spinner-sm"></div>
              Saving...
            </>
          ) : (
            <>
              <FiSave className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// Invoice Settings Tab Component
function InvoiceSettingsTab(): JSX.Element {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings", "invoice"],
    queryFn: async () => {
      const response = await settingsAPI.getInvoiceSettings();
      return response.data;
    },
  });

  const [formData, setFormData] = useState<InvoiceSettingsFormData>({
    prefix: "INV",
    padding: 4,
  });
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      const s = settings as InvoiceSettings;
      setFormData({
        prefix: s.prefix || s.invoicePrefix || s.invoice_prefix || "INV",
        padding: s.padding || 4,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InvoiceSettings>) =>
      settingsAPI.updateInvoiceSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "invoice"] });
      toast.success("Invoice settings updated");
      setIsDirty(false);
    },
    onError: () => {
      toast.error("Failed to update settings");
    },
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "padding" ? Number(value) : value,
    }));
    setIsDirty(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    updateMutation.mutate(formData as unknown as Partial<InvoiceSettings>);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  const s = settings as InvoiceSettings | undefined;
  const nextNumber =
    s?.nextNumber || s?.invoiceNextNumber || s?.invoice_next_number || 1;
  const previewNumber =
    formData.prefix + String(nextNumber).padStart(formData.padding, "0");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Invoice Numbering</h2>
          <p className="text-sm text-gray-500">
            Customize how your invoice numbers are generated
          </p>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="input-group">
              <label className="label">
                <FiHash className="inline w-4 h-4 mr-1" />
                Prefix
              </label>
              <input
                type="text"
                name="prefix"
                value={formData.prefix}
                onChange={handleChange}
                className="input"
                maxLength={20}
                placeholder="INV"
              />
              <p className="input-hint">Letters or text before the number</p>
            </div>
            <div className="input-group">
              <label className="label">Number Padding</label>
              <select
                name="padding"
                value={formData.padding}
                onChange={handleChange}
                className="input"
              >
                {[2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} digits
                  </option>
                ))}
              </select>
              <p className="input-hint">
                Number of digits (with leading zeros)
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">
              Preview of next invoice number:
            </p>
            <p className="text-2xl font-bold text-gray-900">{previewNumber}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {updateMutation.isPending ? (
            <>
              <div className="spinner spinner-sm"></div>
              Saving...
            </>
          ) : (
            <>
              <FiSave className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// Password Tab Component
function PasswordTab(): JSX.Element {
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<PasswordErrors>({});

  const updateMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      settingsAPI.changePassword(data),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: AxiosErrorResponse) => {
      toast.error(error.response?.data?.error || "Failed to change password");
    },
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: PasswordErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (validateForm()) {
      updateMutation.mutate({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Change Password</h2>
          <p className="text-sm text-gray-500">
            Update your password to keep your account secure
          </p>
        </div>
        <div className="card-body space-y-6 max-w-md">
          <div className="input-group">
            <label className="label">
              <FiLock className="inline w-4 h-4 mr-1" />
              Current Password
            </label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className={`input ${errors.currentPassword ? "input-error" : ""}`}
              placeholder="Enter current password"
            />
            {errors.currentPassword && (
              <p className="input-error-message">{errors.currentPassword}</p>
            )}
          </div>

          <div className="input-group">
            <label className="label">New Password</label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className={`input ${errors.newPassword ? "input-error" : ""}`}
              placeholder="Enter new password"
            />
            {errors.newPassword ? (
              <p className="input-error-message">{errors.newPassword}</p>
            ) : (
              <p className="input-hint">Must be at least 6 characters</p>
            )}
          </div>

          <div className="input-group">
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`input ${errors.confirmPassword ? "input-error" : ""}`}
              placeholder="Confirm new password"
            />
            {errors.confirmPassword && (
              <p className="input-error-message">{errors.confirmPassword}</p>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {updateMutation.isPending ? (
            <>
              <div className="spinner spinner-sm"></div>
              Changing...
            </>
          ) : (
            <>
              <FiLock className="w-4 h-4" />
              Change Password
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// Main Settings Page Component
export default function Settings(): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>("profile");

  const tabs = [
    { id: "profile", label: "Profile", icon: FiUser },
    { id: "invoice", label: "Invoice Settings", icon: FiFileText },
    { id: "password", label: "Password", icon: FiLock },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="page-header mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? "tab-active" : ""
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "invoice" && <InvoiceSettingsTab />}
        {activeTab === "password" && <PasswordTab />}
      </div>
    </div>
  );
}
