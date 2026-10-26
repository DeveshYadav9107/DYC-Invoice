// ─────────────────────────────────────────────────────────────────
// Invoices List Page — Search, filter, and review queue
// Client component fetching real invoices from Express API
// Provides row-level & batch CSV export for verified invoices
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import Badge, { getStatusBadgeProps } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import InvoiceListActions from '../components/invoices/InvoiceListActions';
import ExportSingleInvoiceButton from '../components/invoices/ExportSingleInvoiceButton';
import ExportAllValidatedButton from '../components/invoices/ExportAllValidatedButton';
import { formatCurrency, formatDate } from '../utils/helpers';
import api from '../api/client';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const statusParam = searchParams.get('status') || 'ALL';
  const searchParam = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(searchParam);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    invoices: [],
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
    validatedCount: 0,
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', '15');
      if (statusParam && statusParam !== 'ALL') {
        query.set('status', statusParam);
      }
      if (searchParam) {
        query.set('search', searchParam);
      }

      const res = await api.get(`/api/invoices?${query.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusParam, searchParam]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleTabChange = (newStatus) => {
    const params = new URLSearchParams(searchParams);
    params.set('status', newStatus);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
  };

  const invoices = data.invoices || [];
  const total = data.total || 0;
  const totalPages = data.totalPages || 1;
  const validatedInvoices = invoices.filter(
    (inv) => inv.validationStatus === 'MATCHED' || inv.validationStatus === 'VALIDATED'
  );
  const validatedIds = validatedInvoices.map((inv) => inv.id);

  const statusTabs = [
    { label: 'All Invoices', value: 'ALL' },
    { label: '3-Way Matched', value: 'MATCHED' },
    { label: 'Exceptions & Mismatch', value: 'MISMATCH' },
    { label: 'Needs PO Selection', value: 'NEEDS_PO_SELECTION' },
    { label: 'Needs Review', value: 'NEEDS_REVIEW' },
    { label: 'Pending', value: 'PENDING' },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse, inspect, and export verified invoices across the 3-way matching engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {validatedIds.length > 0 && (
            <ExportAllValidatedButton
              invoiceIds={validatedIds}
              count={validatedIds.length}
              onExportCompleted={() => fetchInvoices()}
            />
          )}
          <InvoiceListActions />
        </div>
      </div>

      {/* ─── Filter & Search Bar ───────────────────────────────── */}
      <Card>
        <CardBody className="p-4 sm:p-5 space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-gray-100 pb-3">
            {statusTabs.map((tab) => {
              const active = statusParam === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleTabChange(tab.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer
                    ${active
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-navy-900 hover:bg-gray-100'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by vendor, invoice number, or file name..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.98] text-sm px-4 py-2 rounded-xl gap-2"
            >
              Filter
            </button>
            {searchParam && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  const params = new URLSearchParams(searchParams);
                  params.delete('search');
                  setSearchParams(params);
                }}
                className="text-xs text-gray-500 hover:text-navy-800 underline"
              >
                Clear
              </button>
            )}
          </form>
        </CardBody>
      </Card>

      {/* ─── Invoices Table ────────────────────────────────────── */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
              <p className="text-xs text-gray-400">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8">
              <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
                  <Icon name="FileText" className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">
                  {searchParam ? 'No matching invoices found' : 'No invoices in this view'}
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mb-2 leading-relaxed">
                  {searchParam
                    ? `No invoices matched your query "${searchParam}". Try adjusting your filters.`
                    : 'All invoices submitted to the system will appear here.'}
                </p>
                <p className="text-xs text-gray-400">
                  Verified invoices with status MATCHED or VALIDATED can be downloaded directly as CSV spreadsheets.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-6">Document</th>
                    <th className="py-3 px-6">Vendor</th>
                    <th className="py-3 px-6">Invoice #</th>
                    <th className="py-3 px-6">PO #</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Total Amount</th>
                    <th className="py-3 px-6">3-Way Match</th>
                    <th className="py-3 px-6">Issues</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {invoices.map((inv) => {
                    const statusBadge = getStatusBadgeProps(inv.validationStatus);
                    const issuesCount = inv._count?.validationIssues || (inv.validationIssues ? inv.validationIssues.length : 0);
                    const isMatchedOrValidated = inv.validationStatus === 'MATCHED' || inv.validationStatus === 'VALIDATED';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/80 transition-colors group"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5 max-w-[200px]">
                            <Icon name="FileText" className="w-4 h-4 text-brand-600 flex-shrink-0" />
                            <span className="font-medium text-navy-900 truncate" title={inv.originalFileName}>
                              {inv.originalFileName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-gray-700 truncate max-w-[150px]">
                          {inv.vendor?.name || inv.vendorName || <span className="text-gray-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs text-gray-600">
                          {inv.invoiceNumber || '—'}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs">
                          {inv.purchaseOrder ? (
                            <Link
                              to={`/admin/purchase-orders/${inv.purchaseOrder.id}`}
                              className="text-brand-600 hover:underline font-semibold"
                            >
                              {inv.purchaseOrder.poNumber}
                            </Link>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-gray-500">
                          {formatDate(inv.invoiceDate || inv.createdAt)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-medium text-navy-900 font-mono">
                          {formatCurrency(inv.totalAmount ? Number(inv.totalAmount) : 0, inv.currency || 'USD')}
                        </td>
                        <td className="py-3.5 px-6">
                          <Badge variant={statusBadge.variant} dot={statusBadge.dot}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-6">
                          {issuesCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Icon name="AlertCircle" className="w-3 h-3" />
                              {issuesCount} issue{issuesCount > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isMatchedOrValidated && (
                              <ExportSingleInvoiceButton
                                invoiceId={inv.id}
                                invoiceNumber={inv.invoiceNumber}
                              />
                            )}
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                            >
                              Review
                              <Icon name="ArrowRight" className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Pagination Footer ─────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Showing page <span className="font-semibold text-navy-900">{page}</span> of{' '}
                <span className="font-semibold text-navy-900">{totalPages}</span> ({total} total)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-navy-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-navy-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
