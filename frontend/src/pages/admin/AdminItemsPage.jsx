// ─────────────────────────────────────────────────────────────────
// Admin Items Page — Master Data Management for Products / SKUs
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/helpers';
import api from '../../api/client';
import {
  Package,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react';

const COMMON_UOMS = ['PCS', 'BOX', 'KG', 'LTR', 'MTR', 'SET', 'HRS', 'NOS', 'PKT'];

export default function AdminItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    itemCode: '',
    name: '',
    description: '',
    uom: 'PCS',
    unitPrice: '',
    taxRate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchItems = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      if (isActiveFilter !== 'ALL') params.append('isActive', isActiveFilter);

      const res = await api.get(`/api/items?${params.toString()}`);
      setItems(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [search, isActiveFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      itemCode: '',
      name: '',
      description: '',
      uom: 'PCS',
      unitPrice: '',
      taxRate: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      itemCode: item.itemCode || '',
      name: item.name || '',
      description: item.description || '',
      uom: item.uom || 'PCS',
      unitPrice: item.unitPrice !== null && item.unitPrice !== undefined ? String(item.unitPrice) : '',
      taxRate: item.taxRate !== null && item.taxRate !== undefined ? String(item.taxRate) : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingItem) {
        await api.patch(`/api/items/${editingItem.id}`, formData);
        setSuccessMessage('Item updated successfully.');
      } else {
        await api.post('/api/items', formData);
        setSuccessMessage('Item created successfully.');
      }
      setModalOpen(false);
      fetchItems(pagination.page);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await api.patch(`/api/items/${item.id}`, { isActive: !item.isActive });
      fetchItems(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to update item status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-brand-600" />
            Item & SKU Master Catalog
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Product catalog for standard item descriptions, units of measurement, and PO line mapping.
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Item / SKU
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
              placeholder="Search item code, SKU, or name..."
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
              <option value="ALL">All Items</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* ─── Items Table ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-navy-800">
            Catalog Items ({pagination.total})
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading items...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No items found matching your search.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                  <th className="py-3 px-4">Item Code / SKU</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-center">UOM</th>
                  <th className="py-3 px-4 text-right">Standard Price</th>
                  <th className="py-3 px-4 text-right">Tax Rate</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-700">
                      {item.itemCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-navy-900">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-gray-400 truncate max-w-sm">{item.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] text-gray-700">
                        {item.uom}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-navy-900">
                      {item.unitPrice !== null && item.unitPrice !== undefined
                        ? formatCurrency(Number(item.unitPrice))
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-600">
                      {item.taxRate !== null && item.taxRate !== undefined ? `${Number(item.taxRate)}%` : '0%'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={item.isActive ? 'success' : 'default'} dot={item.isActive} size="sm">
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-navy-900 hover:bg-gray-100 transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.isActive
                            ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={item.isActive ? 'Deactivate Item' : 'Activate Item'}
                      >
                        {item.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* ─── Add/Edit Item Modal ───────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Item / SKU' : 'Register New Item in Catalog'}
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
                Item SKU / Code *
              </label>
              <input
                type="text"
                disabled={Boolean(editingItem)}
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                placeholder="e.g. SKU-1001 (auto if empty)"
                className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200 focus:outline-none focus:border-brand-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. High Pressure Valve"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-navy-800 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Specifications or detailed description"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                UOM *
              </label>
              <input
                type="text"
                required
                list="uom-options"
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value.toUpperCase() })}
                placeholder="PCS"
                className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200 focus:outline-none focus:border-brand-500"
              />
              <datalist id="uom-options">
                {COMMON_UOMS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                placeholder="18"
                className="w-full px-3 py-2 rounded-xl font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
