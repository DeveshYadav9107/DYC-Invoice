// ─────────────────────────────────────────────────────────────────
// Admin Purchase Order Detail Page — Detailed Line Tracking, GRs & Invoices
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { getStatusBadgeProps } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/helpers';
import api from '../../api/client';
import {
  ClipboardList,
  ChevronLeft,
  Building2,
  PackageCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Send,
  Plus,
} from 'lucide-react';

export default function AdminPurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Quick GR Modal from PO detail
  const [grModalOpen, setGrModalOpen] = useState(false);
  const [grForm, setGrForm] = useState({
    grnNumber: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    deliveryNoteNumber: '',
    carrierReference: '',
    remarks: '',
    lines: [],
  });

  const fetchPoDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/purchase-orders/${id}`);
      setPo(res.purchaseOrder);
    } catch (err) {
      setError(err.message || 'Failed to fetch Purchase Order details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPoDetails();
    }
  }, [id, fetchPoDetails]);

  const handleIssuePo = async () => {
    if (!window.confirm(`Issue Purchase Order ${po.poNumber} to vendor ${po.vendor?.name}?`)) return;
    setActionLoading(true);
    try {
      await api.post(`/api/purchase-orders/${id}/issue`);
      setSuccessMessage('Purchase Order officially issued to vendor.');
      fetchPoDetails();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to issue PO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePo = async () => {
    if (!window.confirm(`Close Purchase Order ${po.poNumber}? No further receipts or invoices will be allowed.`)) return;
    setActionLoading(true);
    try {
      await api.post(`/api/purchase-orders/${id}/close`);
      setSuccessMessage('Purchase Order closed.');
      fetchPoDetails();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to close PO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPo = async () => {
    if (!window.confirm(`Cancel Purchase Order ${po.poNumber}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await api.post(`/api/purchase-orders/${id}/cancel`);
      setSuccessMessage('Purchase Order cancelled.');
      fetchPoDetails();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to cancel PO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenQuickGr = () => {
    if (!po) return;
    setGrForm({
      grnNumber: '',
      receiptDate: new Date().toISOString().slice(0, 10),
      deliveryNoteNumber: '',
      carrierReference: '',
      remarks: '',
      lines: (po.lines || []).map((l) => ({
        poLineId: l.id,
        description: l.description,
        orderedQuantity: l.orderedQuantity,
        cumulativeAcceptedQuantity: l.cumulativeAcceptedQuantity || 0,
        remainingToReceive: l.remainingToReceive || 0,
        receivedQuantity: String(l.remainingToReceive || 0),
        acceptedQuantity: String(l.remainingToReceive || 0),
        rejectedQuantity: '0',
        rejectionReason: '',
      })),
    });
    setGrModalOpen(true);
  };

  const handleSubmitGr = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post('/api/goods-receipts', {
        purchaseOrderId: po.id,
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

      setSuccessMessage('Goods Receipt recorded and PO receipt status updated.');
      setGrModalOpen(false);
      fetchPoDetails();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to record Goods Receipt.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        <p className="text-xs text-gray-500">Loading Purchase Order details...</p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <Card className="p-8">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-navy-900 mb-1">Purchase Order Not Found</h2>
          <p className="text-xs text-gray-500 mb-5">{error || 'This order does not exist or access was denied.'}</p>
          <Link
            to="/admin/purchase-orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Purchase Orders
          </Link>
        </Card>
      </div>
    );
  }

  const statusBadge = getStatusBadgeProps(po.status);

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/purchase-orders"
            className="p-2 rounded-xl text-gray-500 hover:text-navy-900 hover:bg-gray-100 transition-colors"
            title="Back to Purchase Orders"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-navy-900">{po.poNumber}</h1>
              <Badge variant={statusBadge.variant} dot={statusBadge.dot} size="md">
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Created on {formatDate(po.createdAt)} by {po.createdBy?.name || 'Admin'}
            </p>
          </div>
        </div>

        {/* Actions based on lifecycle state */}
        <div className="flex items-center gap-2">
          {po.status === 'DRAFT' && (
            <>
              <Button variant="danger" size="sm" onClick={handleCancelPo} loading={actionLoading}>
                Cancel PO
              </Button>
              <Button variant="primary" size="sm" onClick={handleIssuePo} loading={actionLoading}>
                <Send className="w-3.5 h-3.5 mr-1" />
                Issue to Vendor
              </Button>
            </>
          )}

          {(po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
            <>
              <Button variant="secondary" size="sm" onClick={handleClosePo} loading={actionLoading}>
                Close PO
              </Button>
              <Button variant="primary" size="sm" onClick={handleOpenQuickGr}>
                <PackageCheck className="w-3.5 h-3.5 mr-1" />
                Record Goods Receipt (GR)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Feedback message ──────────────────────────────────── */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ─── Header Info Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Vendor Card */}
        <Card>
          <CardBody className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-brand-600" />
              <span>Vendor Information</span>
            </div>
            <div>
              <div className="text-sm font-bold text-navy-900">{po.vendor?.name}</div>
              <div className="text-xs font-mono text-brand-700">{po.vendor?.vendorCode}</div>
              {po.vendor?.taxNumber && (
                <div className="text-[11px] text-gray-500 mt-1">GSTIN: {po.vendor.taxNumber}</div>
              )}
              {po.vendor?.address && (
                <div className="text-[11px] text-gray-400 mt-0.5">{po.vendor.address}</div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Schedule & Commercial Card */}
        <Card>
          <CardBody className="p-4 space-y-2 text-xs">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Dates & Currency
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Date:</span>
                <span className="font-medium text-navy-900">{formatDate(po.orderDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Delivery:</span>
                <span className="font-medium text-navy-900">{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Currency:</span>
                <span className="font-mono font-semibold text-navy-900">{po.currency}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Total Card */}
        <Card className="bg-gradient-to-br from-brand-600 to-brand-800 text-white">
          <CardBody className="p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-100">
              Total Purchase Order Value
            </div>
            <div className="text-2xl font-bold font-mono my-2">
              {formatCurrency(Number(po.totalAmount), po.currency)}
            </div>
            <div className="text-[11px] text-brand-100 flex items-center justify-between">
              <span>Subtotal: {formatCurrency(Number(po.subtotal), po.currency)}</span>
              <span>Tax: {formatCurrency(Number(po.taxAmount), po.currency)}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ─── Line Items with 3-Way Matching Metrics ────────────── */}
      <Card>
        <CardHeader className="py-3.5 px-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-navy-900">
              PO Line Items & Receipt Reconciliation
            </h3>
            <p className="text-xs text-gray-500">
              Tracks actual physical delivery accepted quantities vs invoiced billable quantities.
            </p>
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                <th className="py-3 px-4"># / SKU</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center">UOM</th>
                <th className="py-3 px-4 text-right">Ordered Qty</th>
                <th className="py-3 px-4 text-right">Accepted (GR)</th>
                <th className="py-3 px-4 text-right">Invoiced Qty</th>
                <th className="py-3 px-4 text-right">Remaining Billable</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {po.lines.map((l) => {
                const ordered = Number(l.orderedQuantity);
                const accepted = Number(l.cumulativeAcceptedQuantity || 0);
                const invoiced = Number(l.invoicedQuantity || 0);
                const billable = Number(l.remainingBillableQuantity || 0);
                const pct = ordered > 0 ? Math.min(100, Math.round((accepted / ordered) * 100)) : 0;

                return (
                  <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-700">
                      {l.itemCode || `#${l.lineNumber}`}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-navy-900">{l.description}</div>
                      {/* Mini progress bar of receipt */}
                      <div className="w-36 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-gray-500">
                      {l.uom}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-navy-900">
                      {ordered}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {accepted}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sky-700 font-medium">
                      {invoiced}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-700">
                      {billable}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-600">
                      {formatCurrency(Number(l.unitPrice), po.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-navy-900">
                      {formatCurrency(Number(l.lineTotal), po.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* ─── Linked Goods Receipts & Invoices Split View ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goods Receipts List */}
        <Card>
          <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-900">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>Goods Receipts History ({(po.goodsReceipts || []).length})</span>
            </div>
            {(po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
              <button
                onClick={handleOpenQuickGr}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Record GR
              </button>
            )}
          </CardHeader>
          <CardBody className="p-0">
            {(!po.goodsReceipts || po.goodsReceipts.length === 0) ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No physical Goods Receipts recorded yet. Goods must be delivered & accepted before invoices can match.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {po.goodsReceipts.map((gr) => (
                  <div key={gr.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/50">
                    <div>
                      <div className="font-mono font-bold text-navy-900">{gr.grnNumber}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Received on {formatDate(gr.receiptDate)} by {gr.receivedBy?.name || 'Admin'}
                      </div>
                      {gr.deliveryNoteNumber && (
                        <div className="text-[10px] text-gray-400 font-mono">Challan / Delivery Note: {gr.deliveryNoteNumber}</div>
                      )}
                    </div>
                    <Badge variant={gr.status === 'SUBMITTED' ? 'success' : 'default'} size="sm">
                      {gr.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Linked Invoices List */}
        <Card>
          <CardHeader className="py-3 px-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-900">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Linked Invoices ({(po.invoices || []).length})</span>
            </div>
            <Link
              to="/invoices/upload"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload Invoice
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {(!po.invoices || po.invoices.length === 0) ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No invoices have been billed against this Purchase Order yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs">
                {po.invoices.map((inv) => {
                  const invBadge = getStatusBadgeProps(inv.validationStatus);
                  return (
                    <div key={inv.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/50">
                      <div>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-mono font-bold text-brand-600 hover:underline"
                        >
                          {inv.invoiceNumber || inv.originalFileName}
                        </Link>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {formatDate(inv.createdAt)} • {formatCurrency(Number(inv.totalAmount))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={invBadge.variant} dot={invBadge.dot} size="sm">
                          {invBadge.label}
                        </Badge>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="p-1 rounded text-gray-400 hover:text-navy-900"
                          title="View 3-way verification details"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ─── Quick Goods Receipt Recording Modal ────────────────── */}
      <Modal
        isOpen={grModalOpen}
        onClose={() => setGrModalOpen(false)}
        title={`Record Goods Receipt against ${po.poNumber}`}
      >
        <form onSubmit={handleSubmitGr} className="space-y-4 text-xs">
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
                GRN Number (Auto if empty)
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
                Delivery Note / Challan #
              </label>
              <input
                type="text"
                value={grForm.deliveryNoteNumber}
                onChange={(e) => setGrForm({ ...grForm, deliveryNoteNumber: e.target.value })}
                placeholder="Vendor DC / Challan Number"
                className="w-full px-3 py-2 rounded-xl border border-gray-200"
              />
            </div>

            <div>
              <label className="block font-semibold text-navy-800 mb-1">
                Carrier / Vehicle Ref
              </label>
              <input
                type="text"
                value={grForm.carrierReference}
                onChange={(e) => setGrForm({ ...grForm, carrierReference: e.target.value })}
                placeholder="e.g. Truck MH-04-1234"
                className="w-full px-3 py-2 rounded-xl border border-gray-200"
              />
            </div>
          </div>

          {/* Line items actual receipt inputs */}
          <div className="pt-2 border-t border-gray-100">
            <span className="font-semibold text-navy-900 uppercase tracking-wider text-[11px] block mb-2">
              Enter Actual Quantities Delivered
            </span>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {grForm.lines.map((l, idx) => (
                <div key={l.poLineId} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-navy-900">
                    <span>{l.description}</span>
                    <span className="text-gray-500 font-mono text-[11px]">
                      Ordered: {l.orderedQuantity} • Prev Accepted: {l.cumulativeAcceptedQuantity} • Remaining: {l.remainingToReceive}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500">Total Received Qty *</label>
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
                            newLines[idx].acceptedQuantity = val; // auto-default accepted to received
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="ghost" type="button" onClick={() => setGrModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={actionLoading}>
              Submit Goods Receipt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
