// ─────────────────────────────────────────────────────────────────
// Dashboard Page — Main overview of invoice processing & metrics
// Server component querying real database statistics
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { getStatusBadgeProps } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard — InvoiceFlow',
};

export default async function DashboardPage() {
  const sessionResult = await requireSession();
  if (!sessionResult || !sessionResult.user) {
    return null;
  }
  const user = sessionResult.user;
  const orgId = user.organizationId;

  // Query real metrics if user is attached to an organization
  let totalCount = 0;
  let validatedCount = 0;
  let needsReviewCount = 0;
  let processingCount = 0;
  let totalValidatedAmount = 0;
  let recentInvoices = [];

  if (orgId) {
    const [total, validated, review, processing, amountSum, recents] = await Promise.all([
      prisma.invoice.count({ where: { organizationId: orgId } }),
      prisma.invoice.count({ where: { organizationId: orgId, validationStatus: 'VALIDATED' } }),
      prisma.invoice.count({ where: { organizationId: orgId, validationStatus: 'NEEDS_REVIEW' } }),
      prisma.invoice.count({
        where: {
          organizationId: orgId,
          processingStatus: { in: ['UPLOADED', 'QUEUED', 'PROCESSING'] },
        },
      }),
      prisma.invoice.aggregate({
        where: { organizationId: orgId, validationStatus: 'VALIDATED' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          originalFileName: true,
          vendorName: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          currency: true,
          processingStatus: true,
          validationStatus: true,
          createdAt: true,
        },
      }),
    ]);

    totalCount = total;
    validatedCount = validated;
    needsReviewCount = review;
    processingCount = processing;
    totalValidatedAmount = amountSum._sum.totalAmount ? Number(amountSum._sum.totalAmount) : 0;
    recentInvoices = recents;
  }

  const statCards = [
    {
      title: 'Total Invoices',
      value: totalCount.toLocaleString(),
      subtext: `${processingCount} currently processing`,
      icon: FileText,
      color: 'from-blue-500 to-indigo-600',
      lightBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Validated & Clean',
      value: validatedCount.toLocaleString(),
      subtext: totalCount > 0 ? `${Math.round((validatedCount / totalCount) * 100)}% accuracy rate` : 'Ready for export',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Needs Review',
      value: needsReviewCount.toLocaleString(),
      subtext: needsReviewCount > 0 ? 'Requires attention' : 'No pending discrepancies',
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Validated Value',
      value: formatCurrency(totalValidatedAmount, 'USD'),
      subtext: 'Cumulative processed value',
      icon: TrendingUp,
      color: 'from-brand-500 to-brand-700',
      lightBg: 'bg-brand-50 text-brand-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            Welcome back, {user.name || 'there'}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here is what is happening across {user.organization?.name || 'your organization'} today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/invoices/upload">
            <Button icon={Upload} variant="primary">
              Upload Invoice
            </Button>
          </Link>
          <Link href="/exports">
            <Button icon={Download} variant="secondary">
              Export CSV
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Metric KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <Card key={card.title} hover className="relative overflow-hidden p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {card.title}
              </span>
              <div className={`w-10 h-10 rounded-xl ${card.lightBg} flex items-center justify-center shadow-sm`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
                {card.value}
              </p>
              <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1.5 font-medium">
                {card.subtext}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* ─── Workflow Guide / Pipeline Highlights ───────────────── */}
      <Card className="bg-gradient-to-r from-navy-900 via-navy-950 to-brand-950 text-white p-6 sm:p-8 relative overflow-hidden border-none shadow-elevated">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-brand-300 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Automated Verification Pipeline
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              AI Document Intelligence + Rule Engine
            </h2>
            <p className="text-sm text-navy-200 leading-relaxed">
              Every document is extracted with Azure AI, mathematically cross-checked against tax and line totals, and flagged for discrepancies before CSV export.
            </p>
          </div>
          <Link href="/invoices/upload" className="flex-shrink-0">
            <Button
              variant="secondary"
              icon={ArrowRight}
              className="bg-white text-navy-900 hover:bg-gray-100 font-semibold"
            >
              Start New Upload
            </Button>
          </Link>
        </div>
      </Card>

      {/* ─── Recent Invoices Section ────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-navy-900">Recent Invoices</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest documents submitted to the processing queue</p>
          </div>
          {totalCount > 0 && (
            <Link
              href="/invoices"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </CardHeader>

        <CardBody className="p-0">
          {recentInvoices.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="No invoices uploaded yet"
                description="Upload PDF or image invoices to test Azure AI extraction, automated validation checks, and CSV generation."
                actionLabel="Upload First Invoice"
                actionHref="/invoices/upload"
                actionIcon={Upload}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-6">File Name</th>
                    <th className="py-3 px-6">Vendor</th>
                    <th className="py-3 px-6">Invoice #</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Amount</th>
                    <th className="py-3 px-6">Validation</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {recentInvoices.map((inv) => {
                    const statusBadge = getStatusBadgeProps(inv.validationStatus);
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-6 font-medium text-navy-900 truncate max-w-[200px]">
                          {inv.originalFileName}
                        </td>
                        <td className="py-3.5 px-6 text-gray-600 truncate max-w-[150px]">
                          {inv.vendorName || '—'}
                        </td>
                        <td className="py-3.5 px-6 text-gray-500 font-mono text-xs">
                          {inv.invoiceNumber || '—'}
                        </td>
                        <td className="py-3.5 px-6 text-gray-500 text-xs">
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
                        <td className="py-3.5 px-6 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 p-1.5 rounded-lg hover:bg-brand-50 transition-colors"
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
        </CardBody>
      </Card>
    </div>
  );
}
