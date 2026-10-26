// ─────────────────────────────────────────────────────────────────
// Admin Purchase Orders Page — List, Search & Create POs
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { getStatusBadgeProps } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/helpers';
import api from '../../api/client';
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  PackageCheck,
  FileText,
} from 'lucide-react';

export default function AdminPurchaseOrdersPage() {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Creation modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [vendorsList, setVendorsList] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);

  const [poForm, setPoForm] = useState({
    poNumber: '',
    vendorId: '',
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: '',
    currency: 'USD',
    additionalCharges: '0',
    notes: '',
    terms: '',
    autoIssue: false,
    lines: [
      {
        itemId: '',
        itemCode: '',
        description: '',
        uom: 'PCS',
        orderedQuantity: '1',
        unitPrice: '0',
        discountPercent: '0',
        taxRate: '0',
      },
    ],
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchPurchaseOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await api.get(`/api/purchase-orders?${params.toString()}`);
      setPurchaseOrders(res.purchaseOrders || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchaseOrders(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPurchaseOrders]);

  const loadMasterDataForModal = async () => {
    try {
      const [vRes, iRes] = await Promise.all([
        api.get('/api/vendors?limit=100&isActive=true'),
        api.get('/api/items?limit=100&isActive=true'),
      ]);
      setVendorsList(vRes.vendors || []);
      setItemsCatalog(iRes.items || []);
    } catch (err) {
      console.warn('Could not load master dropdowns:', err);
    }
  };

  const handleOpenCreate = async () => {
    await loadMasterDataForModal();
    setPoForm({
      poNumber: '',
      vendorId: '',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: '',
      currency: 'USD',
      additionalCharges: '0',
      notes: '',
      terms: '',
      autoIssue: false,
      lines: [
        {
          itemId: '',
          itemCode: '',
          description: '',
          uom: 'PCS',
          orderedQuantity: '10',
          unitPrice: '50',
          discountPercent: '0',
          taxRate: '0',
        },
      ],
    });
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleAddLine = () => {
    setPoForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          itemId: '',
          itemCode: '',
          description: '',
          uom: 'PCS',
          orderedQuantity: '1',
          unitPrice: '0',
          discountPercent: '0',
          taxRate: '0',
        },
      ],
    }));
  };

  const handleRemoveLine = (idx) => {
    if (poForm.lines.length <= 1) return;
    setPoForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleLineChange = (idx, field, value) => {
    setPoForm((prev) => {
      const newLines = [...prev.lines];
      newLines[idx] = { ...newLines[idx], [field]: value };

      // If item selected from catalog, auto-fill values
      if (field === 'itemId') {
        const selected = itemsCatalog.find((it) => it.id === value);
        if (selected) {
          newLines[idx].itemCode = selected.itemCode;
          newLines[idx].description = selected.name;
          newLines[idx].uom = selected.uom || 'PCS';
          if (selected.unitPrice) newLines[idx].unitPrice = String(selected.unitPrice);
          if (selected.taxRate) newLines[idx].taxRate = String(selected.taxRate);
        }
      }

      return { ...prev, lines: newLines };
    });
  };

  // Live calculation of PO financial totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const line of poForm.lines) {
      const qty = parseFloat(line.orderedQuantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const discPct = parseFloat(line.discountPercent) || 0;
      const taxRate = parseFloat(line.taxRate) || 0;

      const gross = qty * price;
      const disc = gross * (discPct / 100);
      const net = gross - disc;
      const tax = net * (taxRate / 100);

      subtotal += gross;
      totalDiscount += disc;
      totalTax += tax;
    }

    const additional = parseFloat(poForm.additionalCharges) || 0;
    const grandTotal = subtotal - totalDiscount + totalTax + additional;

    return { subtotal, totalDiscount, totalTax, additional, grandTotal };
  };

  const totals = calculateTotals();

  const handleCreateSubmit = async (e, autoIssue = false) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (!poForm.vendorId) {
        throw new Error('Please select a vendor.');
      }
      if (poForm.lines.length === 0) {
        throw new Error('Please add at least one line item.');
      }

      const payload = {
        ...poForm,
        autoIssue,
      };

      const res = await api.post('/api/purchase-orders', payload);
      setSuccessMessage(`Purchase Order ${res.purchaseOrder.poNumber} created successfully.`);
      setCreateModalOpen(false);
      fetchPurchaseOrders(1);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to create Purchase Order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-brand-600" />
            Purchase Order Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Create authoritative Purchase Orders with line items, agreed prices, and track receipts.
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Purchase Order
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
              placeholder="Search PO number or vendor..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span className="text-gray-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-navy-900 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="FULLY_RECEIVED">Fully Received</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* ─── Purchase Orders Table ─────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-navy-800">
            Purchase Orders ({pagination.total})
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading purchase orders...</span>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">
              <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No purchase orders found matching your filters.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Receipts & Invoices</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseOrders.map((po) => {
                  const statusProps = getStatusBadgeProps(po.status);
                  return (
                    <tr key={po.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/purchase-orders/${po.id}`}
                          className="font-mono font-bold text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-navy-900">{po.vendor?.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{po.vendor?.vendorCode}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDate(po.orderDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={statusProps.variant} dot={statusProps.dot} size="sm">
                          {statusProps.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-navy-900">
                        {formatCurrency(Number(po.totalAmount), po.currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-500">
                          <span className="flex items-center gap-1 text-emerald-700" title="Goods Receipts">
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {po._count?.goodsReceipts || 0} GR
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-sky-700" title="Invoices">
                            <FileText className="w-3.5 h-3.5 text-sky-600" />
                            {po._count?.invoices || 0} Inv
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/admin/purchase-orders/${po.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-navy-800 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* ─── Create Purchase Order Modal ───────────────────────── */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Purchase Order (PO)"
      >
        <form onSubmit={(e) => handleCreateSubmit(e, poForm.autoIssue)} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Header row: Vendor, PO#, Date, Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Vendor Master *
              </label>
              <select
                required
                value={poForm.vendorId}
                onChange={(e) => setPoForm({ ...poForm, vendorId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-brand-500"
              >
                <option value="">Select Vendor...</option>
                {vendorsList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                PO Number (Leave empty to auto-generate)
              </label>
              <input
                type="text"
                value={poForm.poNumber}
                onChange={(e) => setPoForm({ ...poForm, poNumber: e.target.value })}
                placeholder="e.g. PO-2026-0001"
                className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Order Date *
              </label>
              <input
                type="date"
                required
                value={poForm.orderDate}
                onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={poForm.expectedDeliveryDate}
                onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Currency
              </label>
              <input
                type="text"
                value={poForm.currency}
                onChange={(e) => setPoForm({ ...poForm, currency: e.target.value.toUpperCase() })}
                maxLength={3}
                className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Line items section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-navy-900 uppercase tracking-wider text-[11px]">
                Purchase Order Line Items ({poForm.lines.length})
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Line
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {poForm.lines.map((line, idx) => {
                const qty = parseFloat(line.orderedQuantity) || 0;
                const price = parseFloat(line.unitPrice) || 0;
                const discPct = parseFloat(line.discountPercent) || 0;
                const taxRate = parseFloat(line.taxRate) || 0;
                const gross = qty * price;
                const net = gross - gross * (discPct / 100);
                const lineTotal = net + net * (taxRate / 100);

                return (
                  <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-500">
                        Line #{idx + 1}
                      </span>
                      {poForm.lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                          title="Remove line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <select
                          value={line.itemId}
                          onChange={(e) => handleLineChange(idx, 'itemId', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs"
                        >
                          <option value="">Select from catalog (optional)...</option>
                          {itemsCatalog.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.itemCode} — {it.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          type="text"
                          required
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                          placeholder="Line item description *"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 items-center">
                      <div>
                        <label className="block text-[10px] text-gray-500">Ordered Qty *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={line.orderedQuantity}
                          onChange={(e) => handleLineChange(idx, 'orderedQuantity', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500">Unit Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500">Disc (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={line.discountPercent}
                          onChange={(e) => handleLineChange(idx, 'discountPercent', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500">Tax (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={line.taxRate}
                          onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500 text-right">Line Total</label>
                        <div className="text-right font-mono font-bold text-navy-900 py-1">
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial summary card */}
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-4 text-gray-600">
              <div>Subtotal: <span className="font-mono font-semibold text-navy-900">${totals.subtotal.toFixed(2)}</span></div>
              <div>Tax: <span className="font-mono font-semibold text-navy-900">${totals.totalTax.toFixed(2)}</span></div>
              <div>Discount: <span className="font-mono font-semibold text-navy-900">-${totals.totalDiscount.toFixed(2)}</span></div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-navy-900">Grand Total:</span>
              <span className="text-sm font-mono font-bold text-brand-700">${totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 text-xs font-medium text-navy-800 cursor-pointer">
              <input
                type="checkbox"
                checked={poForm.autoIssue}
                onChange={(e) => setPoForm({ ...poForm, autoIssue: e.target.checked })}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Issue Immediately to Vendor</span>
            </label>

            <div className="flex items-center gap-2">
              <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                {poForm.autoIssue ? 'Create & Issue PO' : 'Save Draft PO'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
