// ─────────────────────────────────────────────────────────────────
// Invoices List Page — Search, filter, and review queue
// Server component fetching real invoices from Prisma
// Upload button removed; provides row-level & batch CSV export for verified invoices
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardBody } from '@/components/ui/Card';
import Badge, { getStatusBadgeProps } from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import InvoiceListActions from '@/components/invoices/InvoiceListActions';
import ExportSingleInvoiceButton from '@/components/invoices/ExportSingleInvoiceButton';
import ExportAllValidatedButton from '@/components/invoices/ExportAllValidatedButton';
import { formatCurrency, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoices — InvoiceFlow',
};

export default async function InvoicesPage({ searchParams }) {
  const sessionData = await requireSession();
  if (!sessionData || !sessionData.user) {
    return null;
  }
  const user = sessionData.user;
  const orgId = user.organizationId;
  const isAdmin = user.role === 'ADMIN';

  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedSearchParams?.page || '1', 10));
  const limit = 15;
  const skip = (page - 1) * limit;

  const search = resolvedSearchParams?.search?.trim() || '';
  const validationStatus = resolvedSearchParams?.status || 'ALL';

  // Admins see all invoices across organizations; non-admins scoped to their org
  const where = {};
  if (!isAdmin && orgId) {
    where.organizationId = orgId;
  }

  if (validationStatus && validationStatus !== 'ALL') {
    where.validationStatus = validationStatus;
  }

  if (search) {
    where.OR = [
      { originalFileName: { contains: search, mode: 'insensitive' } },
      { vendorName: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  let total = 0;
  let invoices = [];
  let totalValidatedCount = 0;

  try {
    const validatedWhere = { ...where, validationStatus: 'VALIDATED' };

    const [count, list, valCount] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { validationIssues: true, lineItems: true },
          },
        },
      }),
      prisma.invoice.count({ where: validatedWhere }),
    ]);

    total = count;
    invoices = list;
    totalValidatedCount = valCount;
  } catch (err) {
    console.error('Error querying invoices:', err);
  }

  const totalPages = Math.ceil(total / limit) || 1;

  const validatedInvoices = invoices.filter((inv) => inv.validationStatus === 'VALIDATED');
  const validatedIds = validatedInvoices.map((inv) => inv.id);

  const statusTabs = [
    { label: 'All Invoices', value: 'ALL' },
    { label: 'Validated', value: 'VALIDATED' },
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
            Browse, inspect, and export verified invoices across the system.
          </p>
        </div>

        <InvoiceListActions />
      </div>

      {/* ─── Filter & Search Bar ───────────────────────────────── */}
      <Card>
        <CardBody className="p-4 sm:p-5 space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-gray-100 pb-3">
            {statusTabs.map((tab) => {
              const active = validationStatus === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={`/invoices?status=${tab.value}${search ? `&search=${search}` : ''}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200
                    ${active
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-navy-900 hover:bg-gray-100'
                    }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Search form */}
          <form method="GET" action="/invoices" className="flex items-center gap-3">
            <input type="hidden" name="status" value={validationStatus} />
            <div className="relative flex-1">
              <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by vendor, invoice number, or file name..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.98] text-sm px-4 py-2.5 rounded-xl gap-2"
            >
              Filter
            </button>
          </form>
        </CardBody>
      </Card>

      {/* ─── Invoices Table ────────────────────────────────────── */}
      <Card>
        <CardBody className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8">
              <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
                  <Icon name="FileText" className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">
                  {search ? 'No matching invoices found' : 'No invoices in this view'}
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mb-2 leading-relaxed">
                  {search
                    ? `No invoices matched your query "${search}". Try adjusting your filters.`
                    : 'All invoices submitted to the system will appear here.'}
                </p>
                <p className="text-xs text-gray-400">
                  Verified invoices with status VALIDATED can be downloaded directly as CSV spreadsheets.
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
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Total Amount</th>
                    <th className="py-3 px-6">Validation</th>
                    <th className="py-3 px-6">Issues</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {invoices.map((inv) => {
                    const statusBadge = getStatusBadgeProps(inv.validationStatus);
                    const issuesCount = inv._count?.validationIssues || 0;
                    const isValidated = inv.validationStatus === 'VALIDATED';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/80 transition-colors group"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5 max-w-[220px]">
                            <Icon name="FileText" className="w-4 h-4 text-brand-600 flex-shrink-0" />
                            <span className="font-medium text-navy-900 truncate" title={inv.originalFileName}>
                              {inv.originalFileName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-gray-700 truncate max-w-[160px]">
                          {inv.vendorName || <span className="text-gray-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-3.5 px-6 font-mono text-xs text-gray-600">
                          {inv.invoiceNumber || '—'}
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
                            {isValidated && (
                              <ExportSingleInvoiceButton
                                invoiceId={inv.id}
                                invoiceNumber={inv.invoiceNumber}
                              />
                            )}
                            <Link
                              href={`/invoices/${inv.id}`}
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

          {/* ─── Bottom Action Bar for Verified Invoices ────────────── */}
          {invoices.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 bg-emerald-50/40 border-t border-emerald-100">
              <div className="flex items-center gap-2.5 text-xs text-emerald-900">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                  <Icon name="CheckCircle2" className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-navy-900">
                    {validatedInvoices.length > 0
                      ? `${validatedInvoices.length} Verified Invoice${validatedInvoices.length === 1 ? '' : 's'} on this page`
                      : 'Verified Invoices Export'}
                  </span>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    {validatedInvoices.length > 0
                      ? 'Download individual CSVs via the table buttons above or export all verified documents at once.'
                      : 'When invoices pass automated validation checks, CSV export buttons appear right in their rows.'}
                  </p>
                </div>
              </div>

              {validatedInvoices.length > 0 && (
                <ExportAllValidatedButton
                  invoiceIds={validatedIds}
                  count={validatedInvoices.length}
                />
              )}
            </div>
          )}

          {/* ─── Pagination Footer ──────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-xs text-gray-500">
              <span>
                Showing page {page} of {totalPages} ({total} invoices)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/invoices?page=${page - 1}&status=${validationStatus}${search ? `&search=${search}` : ''}`}
                  >
                    <span className="inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.98] text-xs px-3 py-1.5 rounded-lg gap-1.5">
                      Previous
                    </span>
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/invoices?page=${page + 1}&status=${validationStatus}${search ? `&search=${search}` : ''}`}
                  >
                    <span className="inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.98] text-xs px-3 py-1.5 rounded-lg gap-1.5">
                      Next
                    </span>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
