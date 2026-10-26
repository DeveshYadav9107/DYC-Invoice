// ─────────────────────────────────────────────────────────────────
// ThreeWayVerificationView — Comprehensive 3-Way Match Verification UI
// Displays comparison between PO, Goods Receipts (GR), and Invoice
// Supports PO Linking, Line Mapping, Exception Overrides & Audit Trail
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge, { getStatusBadgeProps } from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ExportSingleInvoiceButton from './ExportSingleInvoiceButton';
import { formatCurrency, formatDate } from '../../utils/helpers';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  PackageCheck,
  Link2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  History,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function ThreeWayVerificationView({ invoice, onInvoiceUpdated }) {
  const { isAdmin } = useAuth();

  // Modals state
  const [showPoModal, setShowPoModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showMapLinesModal, setShowMapLinesModal] = useState(false);

  // Operations loading & messages
  const [reverifying, setReverifying] = useState(false);
  const [linkingPo, setLinkingPo] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [mappingLines, setMappingLines] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Available POs for linking
  const [availablePos, setAvailablePos] = useState([]);
  const [loadingPos, setLoadingPos] = useState(false);
  const [poSearch, setPoSearch] = useState('');

  // Override form
  const [overrideReason, setOverrideReason] = useState('');

  // Line mapping form
  const [lineMappings, setLineMappings] = useState({});

  // Extract latest verification details
  const latestVerification = invoice?.verifications?.[0] || null;
  const lineComparisons = latestVerification?.details?.lineComparisons || [];
  const verificationIssues = invoice?.validationIssues || [];
  const po = invoice?.purchaseOrder || null;
  const goodsReceipts = po?.goodsReceipts || [];
  const statusBadge = getStatusBadgeProps(invoice?.validationStatus);

  // Initialize line mappings when modal opens
  useEffect(() => {
    if (invoice?.lineItems) {
      const initial = {};
      invoice.lineItems.forEach((item) => {
        initial[item.id] = item.poLineId || '';
      });
      setLineMappings(initial);
    }
  }, [invoice]);

  // Load POs for linking modal
  const handleOpenPoModal = async () => {
    setShowPoModal(true);
    try {
      setLoadingPos(true);
      const res = await api.get('/api/purchase-orders?limit=50');
      setAvailablePos(res.purchaseOrders || []);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoadingPos(false);
    }
  };

  // Re-verify invoice
  const handleReverify = async () => {
    setReverifying(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/invoices/${invoice.id}/revalidate`);
      setActionMessage({ type: 'success', text: res.message || 'Invoice re-verified against PO & Goods Receipts.' });
      // Fetch fresh invoice
      const updated = await api.get(`/api/invoices/${invoice.id}`);
      if (onInvoiceUpdated) onInvoiceUpdated(updated.invoice);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Re-verification failed.' });
    } finally {
      setReverifying(false);
    }
  };

  // Link selected PO
  const handleLinkPo = async (purchaseOrderId) => {
    setLinkingPo(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/invoices/${invoice.id}/link-po`, { purchaseOrderId });
      setShowPoModal(false);
      setActionMessage({ type: 'success', text: res.message || 'Purchase Order linked and 3-way match executed.' });
      const updated = await api.get(`/api/invoices/${invoice.id}`);
      if (onInvoiceUpdated) onInvoiceUpdated(updated.invoice);
    } catch (err) {
      alert(err.message || 'Failed to link purchase order.');
    } finally {
      setLinkingPo(false);
    }
  };

  // Override exception (Admin only)
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      alert('An audit reason is required to override verification exceptions.');
      return;
    }

    setOverriding(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/invoices/${invoice.id}/override`, { overrideReason });
      setShowOverrideModal(false);
      setOverrideReason('');
      setActionMessage({ type: 'success', text: res.message || 'Exception approved & overridden.' });
      const updated = await api.get(`/api/invoices/${invoice.id}`);
      if (onInvoiceUpdated) onInvoiceUpdated(updated.invoice);
    } catch (err) {
      alert(err.message || 'Failed to override exception.');
    } finally {
      setOverriding(false);
    }
  };

  // Save manual line mappings
  const handleSaveLineMappings = async (e) => {
    e.preventDefault();
    const mappingsArray = Object.entries(lineMappings)
      .filter(([, poLineId]) => poLineId)
      .map(([invoiceLineId, poLineId]) => ({ invoiceLineId, poLineId }));

    if (mappingsArray.length === 0) {
      alert('Please map at least one invoice line to a PO line.');
      return;
    }

    setMappingLines(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/api/invoices/${invoice.id}/map-lines`, { lineMappings: mappingsArray });
      setShowMapLinesModal(false);
      setActionMessage({ type: 'success', text: res.message || 'Line items mapped and verified successfully.' });
      const updated = await api.get(`/api/invoices/${invoice.id}`);
      if (onInvoiceUpdated) onInvoiceUpdated(updated.invoice);
    } catch (err) {
      alert(err.message || 'Failed to save line mappings.');
    } finally {
      setMappingLines(false);
    }
  };

  // Helper for status badge styling on individual line comparison
  const getLineStatusBadge = (status) => {
    switch (status) {
      case 'MATCHED':
        return <Badge variant="success" size="sm">Matched</Badge>;
      case 'OVERBILLED':
        return <Badge variant="danger" size="sm">Overbilled Qty</Badge>;
      case 'PRICE_MISMATCH':
        return <Badge variant="danger" size="sm">Price Mismatch</Badge>;
      case 'OVER_PO':
        return <Badge variant="danger" size="sm">Over PO Qty</Badge>;
      case 'UNMAPPED':
        return <Badge variant="warning" size="sm">Unmapped</Badge>;
      default:
        return <Badge variant="default" size="sm">{status || 'Pending'}</Badge>;
    }
  };

  // Filter available POs for modal search
  const filteredPos = availablePos.filter((p) => {
    const term = poSearch.toLowerCase();
    return (
      p.poNumber?.toLowerCase().includes(term) ||
      p.vendor?.name?.toLowerCase().includes(term) ||
      p.vendor?.vendorCode?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* ─── Feedback Message Banner ───────────────────────────── */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-sm ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold hover:underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Verification Status Banner & Action Card ──────────── */}
      <Card
        className={`border-2 transition-all shadow-sm ${
          invoice?.validationStatus === 'MATCHED'
            ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/40'
            : invoice?.validationStatus === 'NEEDS_PO_SELECTION'
            ? 'border-purple-200 bg-gradient-to-r from-purple-50/70 via-white to-purple-50/40'
            : invoice?.validationStatus === 'MISMATCH'
            ? 'border-rose-200 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/40'
            : 'border-amber-200 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40'
        }`}
      >
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant={statusBadge.variant} dot={statusBadge.dot} size="lg">
                  {statusBadge.label}
                </Badge>
                {po && (
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-navy-100 text-navy-800 border border-navy-200">
                    <FileCheck2 className="w-3.5 h-3.5 text-navy-600" />
                    PO: {po.poNumber}
                  </span>
                )}
                {latestVerification?.createdAt && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Verified {formatDate(latestVerification.createdAt, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <p className="text-sm text-navy-800 font-medium max-w-2xl leading-relaxed">
                {invoice?.validationStatus === 'MATCHED'
                  ? 'All 3-Way verification checks passed! Line items, accepted Goods Receipt quantities, and agreed PO unit prices match.'
                  : invoice?.validationStatus === 'NEEDS_PO_SELECTION'
                  ? 'No Purchase Order linked. Please link a Purchase Order to verify this invoice against agreed rates and recorded goods receipts.'
                  : invoice?.validationStatus === 'MISMATCH'
                  ? 'Discrepancies detected between the invoice, Purchase Order, and Goods Receipts. Review the itemized breakdown below.'
                  : 'Review required. Discrepancies or unmapped items were identified during verification.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenPoModal}
                title="Link or change Purchase Order"
              >
                <Link2 className="w-3.5 h-3.5 mr-1 text-brand-600" />
                {po ? 'Change PO' : 'Link PO'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                loading={reverifying}
                onClick={handleReverify}
                title="Run three-way verification engine again"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Re-Verify
              </Button>

              {po && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMapLinesModal(true)}
                  title="Map invoice lines to PO lines"
                >
                  <Layers className="w-3.5 h-3.5 mr-1 text-purple-600" />
                  Map Lines
                </Button>
              )}

              {isAdmin && invoice?.validationStatus !== 'MATCHED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowOverrideModal(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  title="Admin Override: approve invoice despite discrepancies"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Override & Approve
                </Button>
              )}

              {(invoice?.validationStatus === 'MATCHED' || invoice?.validationStatus === 'VALIDATED') && (
                <ExportSingleInvoiceButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── PO & Vendor Match Summary Card ────────────────────── */}
      <Card>
        <CardHeader className="py-4 px-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-navy-900">Purchase Order & Commercial Alignment</h3>
          </div>
          {po && (
            <Link
              to={`/admin/purchase-orders/${po.id}`}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              View PO Details
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </CardHeader>

        <CardBody className="p-6">
          {po ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Linked PO Number
                </span>
                <p className="text-base font-bold text-navy-900 font-mono flex items-center gap-2">
                  {po.poNumber}
                  <Badge variant={getStatusBadgeProps(po.status).variant} size="sm">
                    {po.status}
                  </Badge>
                </p>
                <p className="text-xs text-gray-500">Ordered: {formatDate(po.orderDate)}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  PO Vendor
                </span>
                <p className="text-sm font-bold text-navy-900 truncate">
                  {po.vendor?.name || '—'}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  Code: {po.vendor?.vendorCode || '—'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  PO Agreed Value
                </span>
                <p className="text-base font-bold text-navy-900 font-mono">
                  {formatCurrency(po.totalAmount ? Number(po.totalAmount) : 0, po.currency || 'USD')}
                </p>
                <p className="text-xs text-gray-500">
                  Lines: {po.lines?.length || 0} items
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Goods Receipts (GRN)
                </span>
                <p className="text-base font-bold text-navy-900 font-mono flex items-center gap-2">
                  {goodsReceipts.length} Receipt{goodsReceipts.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-emerald-600 font-medium">
                  {goodsReceipts.length > 0 ? 'Delivery recorded in system' : 'Pending warehouse receipt'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-purple-900">No Purchase Order Linked</h4>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Click Link PO to choose an approved purchase order and verify quantities and unit rates.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenPoModal}
                className="bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
              >
                Select Purchase Order
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ─── Validation Discrepancies Alert (if any) ────────────── */}
      {verificationIssues.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/30 overflow-hidden shadow-sm">
          <CardHeader className="py-3.5 px-6 bg-rose-50/80 border-b border-rose-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Verification Discrepancies ({verificationIssues.length})</span>
              </div>
              <span className="text-xs text-rose-700 font-medium">Attention Required</span>
            </div>
          </CardHeader>
          <CardBody className="p-4 space-y-2.5">
            {verificationIssues.map((issue, idx) => (
              <div
                key={issue.id || idx}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-rose-200 shadow-xs"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-900 font-mono uppercase">
                      {issue.code}
                    </span>
                    {issue.field && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                        {issue.field}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mt-1 leading-relaxed">{issue.message}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* ─── Three-Way Comparison Table (Line by Line) ─────────── */}
      <Card>
        <CardHeader className="py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-navy-900">
              Three-Way Line Item Comparison (PO vs GR vs Invoice)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Verified against cumulative accepted Goods Receipts and remaining billable quantities
            </p>
          </div>
          {po && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowMapLinesModal(true)}
              className="text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Remap Lines
            </Button>
          )}
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {lineComparisons.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 uppercase text-[10px] font-bold text-gray-500">
                  <th className="py-3 px-4">Line Item / Description</th>
                  <th className="py-3 px-3 text-right">PO Qty</th>
                  <th className="py-3 px-3 text-right">GR Accepted</th>
                  <th className="py-3 px-3 text-right">Invoiced Prior</th>
                  <th className="py-3 px-3 text-right">Remaining Billable</th>
                  <th className="py-3 px-3 text-right font-bold text-navy-900">Invoice Qty</th>
                  <th className="py-3 px-4 text-right">PO Price</th>
                  <th className="py-3 px-4 text-right font-bold text-navy-900">Invoice Price</th>
                  <th className="py-3 px-4 text-right">Line Total</th>
                  <th className="py-3 px-4 text-center">Match Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineComparisons.map((comp, idx) => {
                  const qtyExceeded = comp.invoiceQty > comp.remainingBillableQty;
                  const priceMismatch = Math.abs(comp.priceDifference || 0) > 0.001;

                  return (
                    <tr
                      key={comp.invoiceLineId || idx}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        qtyExceeded || priceMismatch ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-navy-900 truncate" title={comp.description}>
                          {comp.description}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          SKU: {comp.itemCode} • UOM: {comp.uom}
                        </div>
                        {comp.reason && comp.status !== 'MATCHED' && (
                          <div className="text-[11px] text-rose-600 mt-1 font-medium leading-tight">
                            {comp.reason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-gray-600">
                        {comp.poOrderedQty}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-medium">
                        {comp.grAcceptedQty}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-gray-500">
                        {comp.previouslyInvoicedQty}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-navy-800 bg-gray-50/50">
                        {comp.remainingBillableQty}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          qtyExceeded ? 'text-rose-600 bg-rose-50/60' : 'text-navy-900'
                        }`}
                      >
                        {comp.invoiceQty}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatCurrency(comp.poUnitPrice, invoice?.currency || 'USD')}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          priceMismatch ? 'text-rose-600 bg-rose-50/60' : 'text-navy-900'
                        }`}
                      >
                        {formatCurrency(comp.invoiceUnitPrice, invoice?.currency || 'USD')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-navy-900">
                        {formatCurrency(comp.invoiceTotal, invoice?.currency || 'USD')}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {getLineStatusBadge(comp.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-400 text-xs">
              {po
                ? 'No line item comparison generated. Click Re-Verify to run the three-way matching engine.'
                : 'Link a Purchase Order to view the itemized 3-way quantity and price comparison.'}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ─── Financial & Tax Alignment Card ────────────────────── */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-gray-100">
          <h3 className="text-sm font-bold text-navy-900">Financial & Commercial Verification</h3>
          <p className="text-xs text-gray-500 mt-0.5">Header amounts, calculated taxes, and PO variance</p>
        </CardHeader>
        <CardBody className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Purchase Order Financials */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-200/80 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Purchase Order Baseline
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>PO Subtotal:</span>
                  <span className="font-mono">{formatCurrency(po?.subtotal ? Number(po.subtotal) : 0, po?.currency || 'USD')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>PO Tax:</span>
                  <span className="font-mono">{formatCurrency(po?.taxAmount ? Number(po.taxAmount) : 0, po?.currency || 'USD')}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-navy-900 text-sm">
                  <span>PO Total:</span>
                  <span className="font-mono">{formatCurrency(po?.totalAmount ? Number(po.totalAmount) : 0, po?.currency || 'USD')}</span>
                </div>
              </div>
            </div>

            {/* Invoice Financials */}
            <div className="p-4 rounded-2xl bg-brand-50/40 border border-brand-200/60 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Invoice Extracted Amounts
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Invoice Subtotal:</span>
                  <span className="font-mono">{formatCurrency(invoice?.subtotal ? Number(invoice.subtotal) : 0, invoice?.currency || 'USD')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax Amount:</span>
                  <span className="font-mono">{formatCurrency(invoice?.taxAmount ? Number(invoice.taxAmount) : 0, invoice?.currency || 'USD')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Discount:</span>
                  <span className="font-mono">{formatCurrency(invoice?.discountAmount ? Number(invoice.discountAmount) : 0, invoice?.currency || 'USD')}</span>
                </div>
                <div className="pt-2 border-t border-brand-200 flex justify-between font-bold text-navy-900 text-sm">
                  <span>Invoice Total:</span>
                  <span className="font-mono text-brand-700 font-bold">{formatCurrency(invoice?.totalAmount ? Number(invoice.totalAmount) : 0, invoice?.currency || 'USD')}</span>
                </div>
              </div>
            </div>

            {/* Financial Variance Summary */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-3 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Commercial Variance
              </span>
              {po ? (
                <div className="space-y-2 text-xs">
                  {(() => {
                    const poTot = po.totalAmount ? Number(po.totalAmount) : 0;
                    const invTot = invoice?.totalAmount ? Number(invoice.totalAmount) : 0;
                    const diff = invTot - poTot;
                    const isExceeded = diff > 0.05;

                    return (
                      <>
                        <div className="flex justify-between items-center text-gray-600">
                          <span>Total Amount Diff:</span>
                          <span
                            className={`font-mono font-bold ${
                              isExceeded ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {diff > 0 ? `+${formatCurrency(diff, invoice?.currency || 'USD')}` : formatCurrency(diff, invoice?.currency || 'USD')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-gray-50 text-[11px] leading-relaxed">
                          {isExceeded ? (
                            <span className="text-rose-600 font-medium flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              Invoice exceeds total agreed PO amount by {formatCurrency(diff, invoice?.currency || 'USD')}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Invoice amount is within the agreed PO commercial limit
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Link a PO to calculate commercial variance.</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── Linked Goods Receipts (GRNs) List ─────────────────── */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-navy-900">
              Linked Goods Receipts (GRNs) for this PO ({goodsReceipts.length})
            </h3>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {goodsReceipts.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 uppercase text-[10px] font-bold text-gray-500">
                  <th className="py-3 px-5">GR Number</th>
                  <th className="py-3 px-5">Receipt Date</th>
                  <th className="py-3 px-5">Delivery Note #</th>
                  <th className="py-3 px-5">Received By</th>
                  <th className="py-3 px-5 text-right">Items Accepted</th>
                  <th className="py-3 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {goodsReceipts.map((gr) => {
                  const acceptedCount = (gr.lines || []).reduce(
                    (acc, l) => acc + (Number(l.acceptedQuantity) || 0),
                    0
                  );
                  return (
                    <tr key={gr.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-5 font-mono font-bold text-navy-900">
                        {gr.grNumber}
                      </td>
                      <td className="py-3 px-5 text-gray-600">
                        {formatDate(gr.receiptDate)}
                      </td>
                      <td className="py-3 px-5 font-mono text-gray-600">
                        {gr.deliveryNoteNumber || '—'}
                      </td>
                      <td className="py-3 px-5 text-gray-600">
                        {gr.receivedBy?.name || 'Warehouse Staff'}
                      </td>
                      <td className="py-3 px-5 text-right font-mono font-semibold text-emerald-700">
                        {acceptedCount} units
                      </td>
                      <td className="py-3 px-5 text-center">
                        <Badge variant="success" size="sm">
                          {gr.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-xs text-gray-400">
              No Goods Receipts recorded against this Purchase Order yet.
            </div>
          )}
        </CardBody>
      </Card>

      {/* ─── Verification Audit History ────────────────────────── */}
      {invoice?.verifications && invoice.verifications.length > 0 && (
        <Card>
          <CardHeader className="py-4 px-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-navy-700" />
              <h3 className="text-sm font-bold text-navy-900">
                Verification & Audit History ({invoice.verifications.length})
              </h3>
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 uppercase text-[10px] font-bold text-gray-500">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Run By</th>
                  <th className="py-3 px-5">Outcome</th>
                  <th className="py-3 px-5 text-center">Discrepancies</th>
                  <th className="py-3 px-5">Override Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.verifications.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-5 text-gray-600 whitespace-nowrap">
                      {formatDate(run.createdAt, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-5 text-navy-900 font-medium">
                      {run.performedBy?.name || run.performedBy?.email || 'Automated Engine'}
                    </td>
                    <td className="py-3 px-5">
                      <Badge variant={getStatusBadgeProps(run.overallStatus).variant} size="sm">
                        {run.overallStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 text-center font-mono">
                      {run.discrepancyCount > 0 ? (
                        <span className="text-rose-600 font-semibold">{run.discrepancyCount}</span>
                      ) : (
                        <span className="text-emerald-600">0</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-gray-600 italic max-w-xs truncate">
                      {run.overrideReason ? (
                        <span className="text-amber-800 font-medium not-italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {run.overrideReason}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* ─── MODAL 1: Select Purchase Order Modal ──────────────── */}
      <Modal
        isOpen={showPoModal}
        onClose={() => setShowPoModal(false)}
        title="Link Purchase Order to Invoice"
        description="Select a Purchase Order to verify quantities, item codes, and commercial prices."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 pt-2">
          <input
            type="text"
            placeholder="Search by PO number, vendor name, or vendor code..."
            value={poSearch}
            onChange={(e) => setPoSearch(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {loadingPos ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading purchase orders...</div>
            ) : filteredPos.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No active purchase orders found matching your search.
              </div>
            ) : (
              filteredPos.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 hover:bg-gray-50 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy-900 font-mono text-sm">{item.poNumber}</span>
                      <Badge variant={getStatusBadgeProps(item.status).variant} size="sm">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      Vendor: <span className="font-medium text-navy-800">{item.vendor?.name}</span> ({item.vendor?.vendorCode})
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Ordered: {formatDate(item.orderDate)} • Total: {formatCurrency(item.totalAmount ? Number(item.totalAmount) : 0, item.currency || 'USD')}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    loading={linkingPo}
                    onClick={() => handleLinkPo(item.id)}
                    className="flex-shrink-0"
                  >
                    Select & Verify
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 2: Admin Override Modal ─────────────────────── */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Override Verification Exceptions"
        description="As an Administrator, you can override verification discrepancies and approve this invoice for payment."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleOverrideSubmit} className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Audit Trail Notice</p>
              <p className="mt-0.5">
                Overriding will bypass automated tolerance and receipt quantity checks, marking this invoice as MATCHED. Your name, timestamp, and justification will be recorded permanently in the audit log.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
              Audit Reason / Justification *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Approved price difference per commercial agreement amendment #4; warehouse manager confirmed physical receipt of additional units."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" size="sm" onClick={() => setShowOverrideModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={overriding}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm Override & Approve
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 3: Manual Line Item Mapping Modal ───────────── */}
      <Modal
        isOpen={showMapLinesModal}
        onClose={() => setShowMapLinesModal(false)}
        title="Map Invoice Lines to Purchase Order Lines"
        description="Match each line extracted from the invoice to its corresponding line on Purchase Order."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveLineMappings} className="space-y-4 pt-2">
          <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
            {invoice?.lineItems && invoice.lineItems.length > 0 ? (
              invoice.lineItems.map((invLine) => (
                <div key={invLine.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <span className="font-bold text-navy-900">{invLine.description}</span>
                      <p className="text-gray-500 font-mono mt-0.5">
                        Extracted Qty: {invLine.quantity ? String(invLine.quantity) : '1'} • Extracted Price: {formatCurrency(invLine.unitPrice ? Number(invLine.unitPrice) : null, invoice?.currency || 'USD')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Maps to PO Line:
                    </label>
                    <select
                      value={lineMappings[invLine.id] || ''}
                      onChange={(e) =>
                        setLineMappings((prev) => ({ ...prev, [invLine.id]: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:outline-none focus:border-brand-500 font-mono"
                    >
                      <option value="">— Unmapped —</option>
                      {(po?.lines || []).map((poLine) => (
                        <option key={poLine.id} value={poLine.id}>
                          Line #{poLine.lineNumber}: {poLine.description} ({poLine.itemCode || poLine.item?.itemCode || 'SKU'}) • PO Qty: {poLine.quantity} • PO Price: {formatCurrency(poLine.unitPrice ? Number(poLine.unitPrice) : null, po?.currency || 'USD')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 p-4 text-center">No invoice line items to map.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setShowMapLinesModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={mappingLines}>
              Save Mappings & Re-Verify
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
