import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  FiPlus,
  FiSearch,
  FiMoreVertical,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiMail,
  FiPhone,
  FiUsers,
  FiFileText,
} from 'react-icons/fi';

// Currency formatter
const formatCurrency = (amount, currency = 'GBP') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount || 0);
};

export default function Clients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [openMenuId, setOpenMenuId] = useState(null);

  // Fetch clients
  const { data, isLoading, isError } = useQuery({
    queryKey: ['clients', { search }],
    queryFn: () => clientsAPI.getAll({ search: search || undefined }),
    select: (response) => response.data,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => clientsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
      toast.success('Client deleted');
    },
    onError: (error) => {
      const message = error.response?.data?.error || 'Failed to delete client';
      toast.error(message);
    },
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(search ? { search } : {});
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this client? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
    setOpenMenuId(null);
  };

  const clients = data?.clients || [];

  return (
    <div>
      {/* Page header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Manage your client directory
          </p>
        </div>
        <Link to="/clients/new" className="btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" />
          Add Client
        </Link>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or company..."
                className="input pl-10"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Clients list */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="spinner spinner-lg mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading clients...</p>
        </div>
      ) : isError ? (
        <div className="card p-8 text-center">
          <p className="text-red-500">Failed to load clients</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <FiUsers className="empty-state-icon" />
            <h3 className="empty-state-title">No clients found</h3>
            <p className="empty-state-description">
              {search
                ? 'Try adjusting your search terms'
                : 'Get started by adding your first client'}
            </p>
            {!search && (
              <Link to="/clients/new" className="btn-primary mt-4 inline-flex items-center gap-2">
                <FiPlus className="w-4 h-4" />
                Add Client
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="card card-hover">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/clients/${client.id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-primary-600 truncate block"
                    >
                      {client.company_name || client.name}
                    </Link>
                    {client.company_name && (
                      <p className="text-sm text-gray-500 truncate">{client.name}</p>
                    )}
                  </div>
                  <div className="relative ml-2">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                      className="p-1 rounded-lg hover:bg-gray-100"
                    >
                      <FiMoreVertical className="w-5 h-5 text-gray-400" />
                    </button>

                    {openMenuId === client.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="dropdown-menu">
                          <Link
                            to={`/clients/${client.id}`}
                            className="dropdown-item flex items-center gap-2"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <FiEye className="w-4 h-4" />
                            View
                          </Link>
                          <Link
                            to={`/clients/${client.id}/edit`}
                            className="dropdown-item flex items-center gap-2"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <FiEdit2 className="w-4 h-4" />
                            Edit
                          </Link>
                          <Link
                            to={`/invoices/new?client=${client.id}`}
                            className="dropdown-item flex items-center gap-2"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <FiFileText className="w-4 h-4" />
                            Create Invoice
                          </Link>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(client.id)}
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

                <div className="mt-4 space-y-2">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FiMail className="w-4 h-4 text-gray-400" />
                      <a
                        href={`mailto:${client.email}`}
                        className="hover:text-primary-600 truncate"
                      >
                        {client.email}
                      </a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FiPhone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${client.phone}`} className="hover:text-primary-600">
                        {client.phone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Invoices</p>
                    <p className="font-semibold text-gray-900">{client.invoice_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Billed</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(client.total_billed)}
                    </p>
                  </div>
                </div>

                {parseFloat(client.total_outstanding) > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-yellow-700">Outstanding</span>
                      <span className="font-semibold text-yellow-800">
                        {formatCurrency(client.total_outstanding)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
