// ─────────────────────────────────────────────────────────────────
// InvoiceReviewForm — Interactive review and correction form
// Allows editing extracted invoice data and revalidating
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Button from '../ui/Button';
import Badge, { getStatusBadgeProps } from '../ui/Badge';
import { formatCurrency } from '../../utils/helpers';
import api from '../../api/client';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export default function InvoiceReviewForm({ invoice, onInvoiceUpdated }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    vendorName: invoice?.vendorName || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    invoiceDate: invoice?.invoiceDate ? invoice.invoiceDate.slice(0, 10) : '',
    dueDate: invoice?.dueDate ? invoice.dueDate.slice(0, 10) : '',
    currency: invoice?.currency || 'USD',
    subtotal: invoice?.subtotal !== null && invoice?.subtotal !== undefined ? String(invoice.subtotal) : '',
    taxAmount: invoice?.taxAmount !== null && invoice?.taxAmount !== undefined ? String(invoice.taxAmount) : '',
    discountAmount: invoice?.discountAmount !== null && invoice?.discountAmount !== undefined ? String(invoice.discountAmount) : '',
    totalAmount: invoice?.totalAmount !== null && invoice?.totalAmount !== undefined ? String(invoice.totalAmount) : '',
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);

  const statusBadge = getStatusBadgeProps(invoice?.validationStatus);
  const isValidated = invoice?.validationStatus === 'VALIDATED';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const data = await api.patch(`/api/invoices/${invoice.id}`, formData);
      setMessage({ type: 'success', text: 'Invoice updated and revalidated successfully.' });
      if (onInvoiceUpdated) {
        onInvoiceUpdated(data.invoice);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}`);
      navigate('/invoices');
    } catch (err) {
      alert(err.message || 'Network error while deleting.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Status & Quick Action Card ────────────────────────── */}
      <Card>
        <CardBody className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={statusBadge.variant} dot={statusBadge.dot} size="md">
                {statusBadge.label}
              </Badge>
              {invoice?.extractionConfidence && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  AI Confidence: {Math.round(invoice.extractionConfidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {isValidated
                ? 'All required fields and arithmetic checks passed. Ready for CSV export.'
                : 'Review discrepancies or missing values below and click Save & Revalidate.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSave}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save & Revalidate
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ─── Validation Issues List ────────────────────────────── */}
      {invoice?.validationIssues && invoice.validationIssues.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="py-3.5 px-5 bg-amber-50/70 border-amber-200">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Validation Discrepancies ({invoice.validationIssues.length})</span>
            </div>
          </CardHeader>
          <CardBody className="p-4 space-y-2">
            {invoice.validationIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200 text-xs text-navy-900"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-navy-900">
                    {issue.field ? `Field: ${issue.field}` : issue.code}
                  </div>
                  <p className="text-gray-600 mt-0.5">{issue.message}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* ─── Feedback message ─────────────────────────────────── */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* ─── Form Card ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-navy-900">Invoice Header & Amounts</h3>
          <p className="text-xs text-gray-500 mt-0.5">Editable extracted data points</p>
        </CardHeader>

        <CardBody className="p-6">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Vendor & Invoice # */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleChange}
                  placeholder="e.g. Acme Supplies Inc."
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  placeholder="e.g. INV-2026-001"
                  className="w-full px-3.5 py-2 rounded-xl text-sm font-mono border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>
            </div>

            {/* Dates & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
                  Currency
                </label>
                <input
                  type="text"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  maxLength={3}
                  className="w-full px-3.5 py-2 rounded-xl text-sm uppercase font-mono border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="pt-3 border-t border-gray-100">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Financial Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-navy-600 mb-1">Subtotal</label>
                  <input
                    type="number"
                    step="0.01"
                    name="subtotal"
                    value={formData.subtotal}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-navy-600 mb-1">Tax Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    name="taxAmount"
                    value={formData.taxAmount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-navy-600 mb-1">Discount</label>
                  <input
                    type="number"
                    step="0.01"
                    name="discountAmount"
                    value={formData.discountAmount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono border border-gray-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-navy-600 font-semibold mb-1">Total Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 rounded-xl text-sm font-mono font-bold text-navy-900 border-2 border-brand-500/40 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ─── Line Items Card ──────────────────────────────────── */}
      {invoice?.lineItems && invoice.lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-navy-900">
              Extracted Line Items ({invoice.lineItems.length})
            </h3>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 uppercase text-[10px] font-semibold text-gray-500">
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lineItems.map((item, i) => (
                  <tr key={item.id || i} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 font-medium text-navy-900">{item.description || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{item.quantity ? String(item.quantity) : '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatCurrency(item.unitPrice ? Number(item.unitPrice) : null, invoice.currency || 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">
                      {formatCurrency(item.totalAmount ? Number(item.totalAmount) : null, invoice.currency || 'USD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
