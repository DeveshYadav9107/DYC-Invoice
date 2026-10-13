// ─────────────────────────────────────────────────────────────────
// Dashboard Page — Main overview of invoice processing & metrics
// Server component querying real database statistics
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Badge, { getStatusBadgeProps } from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import ActivityChart from '@/components/dashboard/ActivityChart';
import ValidationChart from '@/components/dashboard/ValidationChart';
import DashboardActions from '@/components/dashboard/DashboardActions';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  const isAdmin = user.role === 'ADMIN';
  const orgWhere = (!isAdmin && orgId) ? { organizationId: orgId } : {};

  // Query real metrics if user is attached to an organization or is system admin
  let totalCount = 0;
  let validatedCount = 0;
  let needsReviewCount = 0;
  let processingCount = 0;
  let totalValidatedAmount = 0;
  let recentInvoices = [];

  if (isAdmin || orgId) {
    const [total, validated, review, processing, amountSum, recents] = await Promise.all([
      prisma.invoice.count({ where: orgWhere }),
      prisma.invoice.count({ where: { ...orgWhere, validationStatus: 'VALIDATED' } }),
      prisma.invoice.count({ where: { ...orgWhere, validationStatus: 'NEEDS_REVIEW' } }),
      prisma.invoice.count({
        where: {
          ...orgWhere,
          processingStatus: { in: ['UPLOADED', 'QUEUED', 'PROCESSING'] },
        },
      }),
      prisma.invoice.aggregate({
        where: { ...orgWhere, validationStatus: 'VALIDATED' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.findMany({
        where: orgWhere,
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

  // Compute status distribution for donut chart
  const statusDistribution = [
    { name: 'Validated', value: validatedCount, color: '#10b981' },
    { name: 'Needs Review', value: needsReviewCount, color: '#f59e0b' },
    { name: 'Processing', value: processingCount, color: '#0284c7' },
  ].filter((item) => item.value > 0);

  // Group recent/available invoices by month for area chart
  const monthMap = new Map();
  recentInvoices.forEach((inv) => {
    const monthKey = new Date(inv.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const cur = monthMap.get(monthKey) || { month: monthKey, count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += inv.totalAmount ? Number(inv.totalAmount) : 0;
    monthMap.set(monthKey, cur);
  });
  const monthlyTrend = Array.from(monthMap.values());

  const statCards = [
    {
      title: 'Total Invoices',
      value: totalCount.toLocaleString(),
      subtext: `${processingCount} currently processing`,
      iconName: 'FileText',
      color: 'from-blue-500 to-indigo-600',
      lightBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Validated & Clean',
      value: validatedCount.toLocaleString(),
      subtext: totalCount > 0 ? `${Math.round((validatedCount / totalCount) * 100)}% accuracy rate` : 'Ready for export',
      iconName: 'CheckCircle2',
      color: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Needs Review',
      value: needsReviewCount.toLocaleString(),
      subtext: needsReviewCount > 0 ? 'Requires attention' : 'No pending discrepancies',
      iconName: 'AlertTriangle',
      color: 'from-amber-500 to-orange-600',
      lightBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Validated Value',
      value: formatCurrency(totalValidatedAmount, 'USD'),
      subtext: 'Cumulative processed value',
      iconName: 'TrendingUp',
      color: 'from-brand-500 to-brand-700',
      lightBg: 'bg-brand-50 text-brand-600',
    },
  ];

  // Serialize dates for client components
  const serializedInvoices = recentInvoices.map((inv) => ({
    ...inv,
    totalAmount: inv.totalAmount ? Number(inv.totalAmount) : null,
    invoiceDate: inv.invoiceDate ? inv.invoiceDate.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
  }));

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

        <DashboardActions />
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
                <Icon name={card.iconName} className="w-5 h-5" />
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
              <Icon name="Sparkles" className="w-3.5 h-3.5" />
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
            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-navy-900 hover:bg-gray-100 transition-colors shadow-sm">
              Start New Upload
              <Icon name="ArrowRight" className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </Card>

      {/* ─── Interactive Telemetry Charts ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart data={monthlyTrend} />
        </div>
        <div className="lg:col-span-1">
          <ValidationChart data={statusDistribution} />
        </div>
      </div>

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
              <Icon name="ArrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </CardHeader>

        <CardBody className="p-0">
          {serializedInvoices.length === 0 ? (
            <div className="p-6">
              <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
                  <Icon name="FileText" className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">No invoices uploaded yet</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                  Upload PDF or image invoices to test Azure AI extraction, automated validation checks, and CSV generation.
                </p>
                <Link href="/invoices/upload">
                  <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white shadow-sm transition-all">
                    <Icon name="Upload" className="w-4 h-4" />
                    Upload First Invoice
                  </span>
                </Link>
              </div>
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
                  {serializedInvoices.map((inv) => {
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
                          {formatCurrency(inv.totalAmount != null ? inv.totalAmount : 0, inv.currency || 'USD')}
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
                            <Icon name="ArrowRight" className="w-3.5 h-3.5" />
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
