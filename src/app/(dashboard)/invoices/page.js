// ─────────────────────────────────────────────────────────────────
// Invoices List Page — Search, filter, and review queue
// Server component fetching real invoices from Prisma
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { getStatusBadgeProps } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileText,
  Upload,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Download,
  AlertCircle,
} from 'lucide-react';

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

  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, parseInt(resolvedSearchParams?.page || '1', 10));
  const limit = 15;
  const skip = (page - 1) * limit;

  const search = resolvedSearchParams?.search?.trim() || '';
  const validationStatus = resolvedSearchParams?.status || 'ALL';

  const where = {
    organizationId: orgId || undefined,
  };

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

  if (orgId) {
    const [count, list] = await Promise.all([
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
    ]);
    total = count;
    invoices = list;
  }

  const totalPages = Math.ceil(total / limit) || 1;

  const statusTabs = [
    { label: 'All Invoices', value: 'ALL' },
    { label: 'Validated', value: 'VALIDATED' },
    { label: 'Needs Review', value: 'NEEDS_REVIEW' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Rejected', value: 'REJECTED' },
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
            Browse, inspect, and review extracted invoices across your organization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/exports">
            <Button variant="secondary" icon={Download}>
              Exports
            </Button>
          </Link>
          <Link href="/invoices/upload">
            <Button variant="primary" icon={Upload}>
              Upload Invoice
            </Button>
          </Link>
        </div>
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by vendor, invoice number, or file name..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">
              Filter
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* ─── Invoices Table ────────────────────────────────────── */}
      <Card>
        <CardBody className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title={search ? 'No matching invoices found' : 'No invoices in this view'}
                description={
                  search
                    ? `No invoices matched your query "${search}". Try adjusting your filters.`
                    : 'Upload invoices to start automated extraction and validation.'
                }
                actionLabel="Upload Invoices"
                actionHref="/invoices/upload"
                actionIcon={Upload}
              />
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

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5 max-w-[220px]">
                            <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
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
                              <AlertCircle className="w-3 h-3" />
                              {issuesCount} issue{issuesCount > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
                          >
                            Review
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                    <Button variant="secondary" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/invoices?page=${page + 1}&status=${validationStatus}${search ? `&search=${search}` : ''}`}
                  >
                    <Button variant="secondary" size="sm">
                      Next
                    </Button>
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
