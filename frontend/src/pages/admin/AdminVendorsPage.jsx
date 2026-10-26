// ─────────────────────────────────────────────────────────────────
// Admin Vendors Page — Master Data Management for Vendors
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import api from '../../api/client';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Mail,
  Phone,
} from 'lucide-react';

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    vendorCode: '',
    taxNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchVendors = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      if (isActiveFilter !== 'ALL') params.append('isActive', isActiveFilter);

      const res = await api.get(`/api/vendors?${params.toString()}`);
      setVendors(res.vendors || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
    } finally {
      setLoading(false);
    }
  }, [search, isActiveFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchVendors]);

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      vendorCode: '',
      taxNumber: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name || '',
      vendorCode: vendor.vendorCode || '',
      taxNumber: vendor.taxNumber || '',
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingVendor) {
        await api.patch(`/api/vendors/${editingVendor.id}`, formData);
        setSuccessMessage('Vendor updated successfully.');
      } else {
        await api.post('/api/vendors', formData);
        setSuccessMessage('Vendor created successfully.');
      }
      setModalOpen(false);
      fetchVendors(pagination.page);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (vendor) => {
    try {
      await api.patch(`/api/vendors/${vendor.id}`, { isActive: !vendor.isActive });
      fetchVendors(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to update vendor status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-brand-600" />
            Vendor Master Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Authoritative vendor records used for Purchase Orders and Three-Way Invoice Verification.
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Vendor
        </Button>
      </div>

      {/* ─── Feedback message ──────────────────────────────────── */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ─── Filters & Search ──────────────────────────────────── */}
      <Card>
        <CardBody className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor name, code, tax ID..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span className="text-gray-500 font-medium">Status:</span>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-navy-900 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Vendors</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* ─── Vendors Table ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-navy-800">
            Registered Vendors ({pagination.total})
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading vendors...</span>
            </div>
          ) : vendors.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No vendors found matching your criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                  <th className="py-3 px-4">Vendor Code</th>
                  <th className="py-3 px-4">Vendor Name</th>
                  <th className="py-3 px-4">GSTIN / Tax ID</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-700">
                      {v.vendorCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-navy-900">{v.name}</div>
                      {v.address && (
                        <div className="text-[11px] text-gray-400 truncate max-w-xs">{v.address}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {v.taxNumber || '—'}
                    </td>
                    <td className="py-3 px-4 space-y-0.5">
                      {v.contactPerson && (
                        <div className="text-navy-800 font-medium">{v.contactPerson}</div>
                      )}
                      {v.email && (
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{v.email}</span>
                        </div>
                      )}
                      {v.phone && (
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{v.phone}</span>
                        </div>
                      )}
                      {!v.contactPerson && !v.email && !v.phone && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={v.isActive ? 'success' : 'default'} dot={v.isActive} size="sm">
                        {v.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                        <span title="Linked Purchase Orders" className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-brand-600" />
                          {v._count?.purchaseOrders || 0} POs
                        </span>
                        <span>•</span>
                        <span>{v._count?.invoices || 0} Invoices</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-navy-900 hover:bg-gray-100 transition-colors"
                        title="Edit Vendor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(v)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          v.isActive
                            ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={v.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
                      >
                        {v.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* ─── Add/Edit Vendor Modal ─────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVendor ? 'Edit Vendor Details' : 'Register New Vendor Master'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Vendor Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Acme Industrial Corp"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Vendor Code (Optional)
              </label>
              <input
                type="text"
                disabled={Boolean(editingVendor)}
                value={formData.vendorCode}
                onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
                placeholder="Auto-generated if empty"
                className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200 focus:outline-none focus:border-brand-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                GSTIN / Tax Number
              </label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                placeholder="e.g. 27AAAAA0000A1Z5"
                className="w-full px-3 py-2 rounded-xl font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="accounts@vendor.com"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 555-0199"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-navy-800 mb-1">
              Physical Address
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Full billing / warehouse address"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingVendor ? 'Save Changes' : 'Create Vendor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
