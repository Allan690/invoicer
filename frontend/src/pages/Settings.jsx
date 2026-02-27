import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiUser,
  FiMail,
  FiBriefcase,
  FiMapPin,
  FiPhone,
  FiDollarSign,
  FiFileText,
  FiLock,
  FiSave,
  FiHash,
} from 'react-icons/fi';

const CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

// Profile Tab Component
function ProfileTab() {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: async () => {
      const response = await settingsAPI.getProfile();
      return response.data;
    },
  });

  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Update form data when profile loads
  useState(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        businessName: profile.businessName || '',
        address: profile.address || '',
        phone: profile.phone || '',
        defaultCurrency: profile.defaultCurrency || 'GBP',
        taxNumber: profile.taxNumber || '',
        bankName: profile.bankName || '',
        bankAccountNumber: profile.bankAccountNumber || '',
        bankSortCode: profile.bankSortCode || '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data) => settingsAPI.updateProfile(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['settings', 'profile']);
      updateUser(response.data.user);
      toast.success('Profile updated successfully');
      setIsDirty(false);
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  const currentData = {
    fullName: formData.fullName ?? profile?.fullName ?? '',
    businessName: formData.businessName ?? profile?.businessName ?? '',
    address: formData.address ?? profile?.address ?? '',
    phone: formData.phone ?? profile?.phone ?? '',
    defaultCurrency: formData.defaultCurrency ?? profile?.defaultCurrency ?? 'GBP',
    taxNumber: formData.taxNumber ?? profile?.taxNumber ?? '',
    bankName: formData.bankName ?? profile?.bankName ?? '',
    bankAccountNumber: formData.bankAccountNumber ?? profile?.bankAccountNumber ?? '',
    bankSortCode: formData.bankSortCode ?? profile?.bankSortCode ?? '',
  };

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
              value={currentData.fullName}
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
              value={currentData.businessName}
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
              value={currentData.address}
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
              value={currentData.phone}
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
              value={currentData.defaultCurrency}
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
              value={currentData.taxNumber}
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
              value={currentData.bankName}
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
              value={currentData.bankAccountNumber}
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
              value={currentData.bankSortCode}
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
function InvoiceSettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'invoice'],
    queryFn: async () => {
      const response = await settingsAPI.getInvoiceSettings();
      return response.data;
    },
  });

  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data) => settingsAPI.updateInvoiceSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings', 'invoice']);
      toast.success('Invoice settings updated');
      setIsDirty(false);
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  const currentData = {
    prefix: formData.prefix ?? settings?.prefix ?? 'INV',
    padding: formData.padding ?? settings?.padding ?? 4,
  };

  const previewNumber =
    currentData.prefix +
    String(settings?.nextNumber || 1).padStart(Number(currentData.padding) || 4, '0');

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
                value={currentData.prefix}
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
                value={currentData.padding}
                onChange={handleChange}
                className="input"
              >
                {[2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} digits
                  </option>
                ))}
              </select>
              <p className="input-hint">Number of digits (with leading zeros)</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Preview of next invoice number:</p>
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
function PasswordTab() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const updateMutation = useMutation({
    mutationFn: (data) => settingsAPI.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to change password');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
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
              className={`input ${errors.currentPassword ? 'input-error' : ''}`}
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
              className={`input ${errors.newPassword ? 'input-error' : ''}`}
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
              className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
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
export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'invoice', label: 'Invoice Settings', icon: FiFileText },
    { id: 'password', label: 'Password', icon: FiLock },
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
              activeTab === tab.id ? 'tab-active' : ''
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'invoice' && <InvoiceSettingsTab />}
        {activeTab === 'password' && <PasswordTab />}
      </div>
    </div>
  );
}
