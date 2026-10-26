// ─────────────────────────────────────────────────────────────────
// Admin Goods Receipts Page — Physical Delivery Records & GRN Creation
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { getStatusBadgeProps } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import api from '../../api/client';
import {
  PackageCheck,
  Plus,
  Search,
  Eye,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  ClipboardList,
} from 'lucide-react';

export default function AdminGoodsReceiptsPage() {
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Creation modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [eligiblePos, setEligiblePos] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  const [loadingPo, setLoadingPo] = useState(false);

  const [grForm, setGrForm] = useState({
    grnNumber: '',
    purchaseOrderId: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    deliveryNoteNumber: '',
    carrierReference: '',
    remarks: '',
    lines: [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchGoodsReceipts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);

      const res = await api.get(`/api/goods-receipts?${params.toString()}`);
      setGoodsReceipts(res.goodsReceipts || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch goods receipts:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGoodsReceipts(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchGoodsReceipts]);

  const handleOpenCreateModal = async () => {
    try {
      setLoadingPo(true);
      setFormError('');
      // Fetch POs that are ISSUED or PARTIALLY_RECEIVED
      const [pIssued, pPartial] = await Promise.all([
        api.get('/api/purchase-orders?status=ISSUED&limit=50'),
        api.get('/api/purchase-orders?status=PARTIALLY_RECEIVED&limit=50'),
      ]);

      const all = [...(pIssued.purchaseOrders || []), ...(pPartial.purchaseOrders || [])];
      setEligiblePos(all);
      setSelectedPo(null);
      setGrForm({
        grnNumber: '',
        purchaseOrderId: '',
        receiptDate: new Date().toISOString().slice(0, 10),
        deliveryNoteNumber: '',
        carrierReference: '',
        remarks: '',
        lines: [],
      });
      setModalOpen(true);
    } catch (err) {
      alert('Could not load eligible Purchase Orders.');
    } finally {
      setLoadingPo(false);
    }
  };

  const handlePoSelect = async (poId) => {
    if (!poId) {
      setSelectedPo(null);
      setGrForm((prev) => ({ ...prev, purchaseOrderId: '', lines: [] }));
      return;
    }

    try {
      setLoadingPo(true);
      const res = await api.get(`/api/purchase-orders/${poId}`);
      const poData = res.purchaseOrder;
      setSelectedPo(poData);

      setGrForm((prev) => ({
        ...prev,
        purchaseOrderId: poId,
        lines: (poData.lines || []).map((l) => ({
          poLineId: l.id,
          description: l.description,
          orderedQuantity: l.orderedQuantity,
          cumulativeAcceptedQuantity: l.cumulativeAcceptedQuantity || 0,
          remainingToReceive: l.remainingToReceive !== undefined ? l.remainingToReceive : l.orderedQuantity,
          receivedQuantity: String(l.remainingToReceive !== undefined ? l.remainingToReceive : l.orderedQuantity),
          acceptedQuantity: String(l.remainingToReceive !== undefined ? l.remainingToReceive : l.orderedQuantity),
          rejectedQuantity: '0',
          rejectionReason: '',
        })),
      }));
    } catch (err) {
      setFormError('Failed to load PO lines.');
    } finally {
      setLoadingPo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (!grForm.purchaseOrderId) {
        throw new Error('Please select a Purchase Order.');
      }

      await api.post('/api/goods-receipts', {
        purchaseOrderId: grForm.purchaseOrderId,
        grnNumber: grForm.grnNumber || undefined,
        receiptDate: grForm.receiptDate,
        deliveryNoteNumber: grForm.deliveryNoteNumber,
        carrierReference: grForm.carrierReference,
        remarks: grForm.remarks,
        lines: grForm.lines.map((l) => ({
          poLineId: l.poLineId,
          receivedQuantity: parseFloat(l.receivedQuantity) || 0,
          acceptedQuantity: parseFloat(l.acceptedQuantity) || 0,
          rejectedQuantity: parseFloat(l.rejectedQuantity) || 0,
          rejectionReason: l.rejectionReason,
        })),
      });

      setSuccessMessage('Goods Receipt recorded and PO receipt status updated successfully.');
      setModalOpen(false);
      fetchGoodsReceipts(1);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to submit Goods Receipt.');
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
            <PackageCheck className="w-6 h-6 text-emerald-600" />
            Goods Receipt (GR/GRN) Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Authoritative physical goods delivery records required for PO three-way invoice matching.
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-4 h-4 mr-1.5" />
          Record Goods Receipt
        </Button>
      </div>

      {/* ─── Feedback message ──────────────────────────────────── */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ─── Search ────────────────────────────────────────────── */}
      <Card>
        <CardBody className="p-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search GRN number, PO number, or delivery note..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </CardBody>
      </Card>

      {/* ─── Goods Receipts Table ──────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-navy-800">
            Recorded Goods Receipts ({pagination.total})
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-xs">Loading Goods Receipts...</span>
            </div>
          ) : goodsReceipts.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">
              <PackageCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No Goods Receipts recorded yet. Select an issued Purchase Order to record delivery.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                  <th className="py-3 px-4">GRN Number</th>
                  <th className="py-3 px-4">Referenced PO</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Delivery Note / Challan</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {goodsReceipts.map((gr) => (
                  <tr key={gr.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                      {gr.grnNumber}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/admin/purchase-orders/${gr.purchaseOrder?.id}`}
                        className="font-mono font-semibold text-brand-600 hover:underline"
                      >
                        {gr.purchaseOrder?.poNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-navy-900">
                      {gr.purchaseOrder?.vendor?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(gr.receiptDate)}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">
                      {gr.deliveryNoteNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {gr.receivedBy?.name || gr.receivedBy?.email || 'Admin'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={gr.status === 'SUBMITTED' ? 'success' : 'default'} dot={gr.status === 'SUBMITTED'} size="sm">
                        {gr.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* ─── Record Goods Receipt Modal ────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Goods Receipt (GRN) Against Purchase Order"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Select PO */}
          <div>
            <label className="block font-semibold text-navy-800 mb-1">
              Select Purchase Order *
            </label>
            <select
              required
              value={grForm.purchaseOrderId}
              onChange={(e) => handlePoSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-brand-500"
            >
              <option value="">Choose an Issued / Partially Received PO...</option>
              {eligiblePos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} — {p.vendor?.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {loadingPo && (
            <div className="py-4 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              <span>Loading PO lines...</span>
            </div>
          )}

          {selectedPo && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-800 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={grForm.receiptDate}
                    onChange={(e) => setGrForm({ ...grForm, receiptDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-navy-800 mb-1">
                    GRN Number (Auto-generated if empty)
                  </label>
                  <input
                    type="text"
                    value={grForm.grnNumber}
                    onChange={(e) => setGrForm({ ...grForm, grnNumber: e.target.value })}
                    placeholder="e.g. GRN-2026-0001"
                    className="w-full px-3 py-2 rounded-xl font-mono uppercase border border-gray-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-800 mb-1">
                    Delivery Note / Challan / Waybill #
                  </label>
                  <input
                    type="text"
                    value={grForm.deliveryNoteNumber}
                    onChange={(e) => setGrForm({ ...grForm, deliveryNoteNumber: e.target.value })}
                    placeholder="Vendor Challan # (e.g. DC-98432)"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-navy-800 mb-1">
                    Vehicle / Carrier Reference
                  </label>
                  <input
                    type="text"
                    value={grForm.carrierReference}
                    onChange={(e) => setGrForm({ ...grForm, carrierReference: e.target.value })}
                    placeholder="e.g. FedEx / Van DL-10-892"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              {/* Line items actual receipt inputs */}
              <div className="pt-2 border-t border-gray-100">
                <span className="font-semibold text-navy-900 uppercase tracking-wider text-[11px] block mb-2">
                  Actual Delivered Quantities
                </span>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {grForm.lines.map((l, idx) => (
                    <div key={l.poLineId} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                      <div className="flex items-center justify-between font-semibold text-navy-900">
                        <span>{l.description}</span>
                        <span className="text-gray-500 font-mono text-[11px]">
                          Ordered: {l.orderedQuantity} • Remaining: {l.remainingToReceive}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500">Delivered Qty *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={l.remainingToReceive}
                            required
                            value={l.receivedQuantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGrForm((prev) => {
                                const newLines = [...prev.lines];
                                newLines[idx].receivedQuantity = val;
                                newLines[idx].acceptedQuantity = val;
                                return { ...prev, lines: newLines };
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-gray-200 font-mono text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-500 font-semibold text-emerald-700">Accepted Qty *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={l.remainingToReceive}
                            required
                            value={l.acceptedQuantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGrForm((prev) => {
                                const newLines = [...prev.lines];
                                newLines[idx].acceptedQuantity = val;
                                return { ...prev, lines: newLines };
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-gray-200 font-mono text-xs bg-white text-emerald-800 font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-500">Rejected Qty</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.rejectedQuantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGrForm((prev) => {
                                const newLines = [...prev.lines];
                                newLines[idx].rejectedQuantity = val;
                                return { ...prev, lines: newLines };
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-gray-200 font-mono text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-800 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={grForm.remarks}
                  onChange={(e) => setGrForm({ ...grForm, remarks: e.target.value })}
                  placeholder="Package condition, inspector notes..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={submitting}>
                  Submit Goods Receipt
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
