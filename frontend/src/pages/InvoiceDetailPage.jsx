// ─────────────────────────────────────────────────────────────────
// Invoice Detail & Verification Review Page — Two-column view
// Document preview on left, extracted fields + review form on right
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import InvoiceReviewForm from '../components/invoices/InvoiceReviewForm';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import InvoiceDetailActions from '../components/invoices/InvoiceDetailActions';
import { formatFileSize, formatDate } from '../utils/helpers';
import api, { getApiUrl } from '../api/client';
import { Loader2 } from 'lucide-react';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadInvoice() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get(`/api/invoices/${id}`);
        setInvoice(data.invoice);
      } catch (err) {
        setError(err.message || 'Invoice not found or access denied.');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadInvoice();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-gray-500">Loading invoice document and extracted fields...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <Card className="p-8">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Icon name="AlertTriangle" className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-navy-900 mb-1">Invoice Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'This invoice may have been deleted or moved.'}</p>
          <Link
            to="/invoices"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            <Icon name="ChevronLeft" className="w-4 h-4" />
            Back to Invoices
          </Link>
        </Card>
      </div>
    );
  }

  const isPdf = invoice.mimeType === 'application/pdf';
  const fileUrl = `/api/invoices/${invoice.id}/file`;
  const absoluteFileUrl = getApiUrl(fileUrl);

  return (
    <div className="space-y-6">
      {/* ─── Top Breadcrumb Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/invoices"
            className="p-2 rounded-xl text-gray-500 hover:text-navy-900 hover:bg-gray-100 transition-colors"
            title="Back to invoices"
          >
            <Icon name="ChevronLeft" className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-navy-900 truncate max-w-md">
                {invoice.originalFileName}
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Uploaded on {formatDate(invoice.createdAt)} by {invoice.uploadedBy?.name || invoice.uploadedBy?.email || 'User'}
            </p>
          </div>
        </div>

        <InvoiceDetailActions fileUrl={fileUrl} originalFileName={invoice.originalFileName} />
      </div>

      {/* ─── Two-Column Split Review Grid ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ─── Left: Document Viewer ──────────────────────────── */}
        <Card className="sticky top-20 overflow-hidden bg-navy-950/5">
          <CardHeader className="bg-white flex flex-row items-center justify-between py-3 px-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-800">
              <Icon name="FileText" className="w-4 h-4 text-brand-600" />
              <span>Original Document Viewer</span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              {formatFileSize(invoice.fileSize)} • {invoice.mimeType}
            </span>
          </CardHeader>

          <CardBody className="p-0 bg-gray-900/5">
            <div className="w-full h-[750px] flex items-center justify-center bg-gray-100/50">
              {isPdf ? (
                <iframe
                  src={`${absoluteFileUrl}#toolbar=0`}
                  title="Invoice PDF Preview"
                  className="w-full h-full border-none rounded-b-2xl"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={absoluteFileUrl}
                    alt="Invoice preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ─── Right: Extracted Fields & Review Form ──────────── */}
        <InvoiceReviewForm
          invoice={invoice}
          onInvoiceUpdated={(updated) => setInvoice(updated)}
        />
      </div>
    </div>
  );
}
