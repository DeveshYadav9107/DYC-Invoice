// ─────────────────────────────────────────────────────────────────
// Dashboard Page — Main overview of invoice processing & metrics
// Fetches real database statistics from Express API
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Badge, { getStatusBadgeProps } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import ActivityChart from '../components/dashboard/ActivityChart';
import ValidationChart from '../components/dashboard/ValidationChart';
import DashboardActions from '../components/dashboard/DashboardActions';
import { formatCurrency, formatDate } from '../utils/helpers';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    counts: { total: 0, validated: 0, needsReview: 0, rejected: 0, processing: 0 },
    totalAmount: 0,
    statusDistribution: [],
    monthlyTrend: [],
    recentInvoices: [],
  });

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const res = await api.get('/api/dashboard/stats');
        setData(res);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const totalCount = data.counts.total || 0;
  const matchedCount = data.counts.matched ?? data.counts.validated ?? 0;
  const mismatchedCount = data.counts.mismatched || 0;
  const needsPoSelectionCount = data.counts.needsPoSelection || 0;
  const purchaseOrdersCount = data.counts.purchaseOrders || 0;
  const goodsReceiptsCount = data.counts.goodsReceipts || 0;
  const vendorsCount = data.counts.vendors || 0;
  const totalValidatedAmount = data.totalAmount || 0;
  const recentInvoices = data.recentInvoices || [];
  const statusDistribution = data.statusDistribution || [];
  const monthlyTrend = data.monthlyTrend || [];

  const statCards = [
    {
      title: '3-Way Matched',
      value: matchedCount.toLocaleString(),
      subtext: totalCount > 0 ? `${Math.round((matchedCount / totalCount) * 100)}% verification rate` : 'Ready for payment & export',
      iconName: 'CheckCircle2',
      color: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Exceptions & Mismatch',
      value: mismatchedCount.toLocaleString(),
      subtext: mismatchedCount > 0 ? 'Requires attention / override' : 'Zero discrepancies detected',
      iconName: 'AlertTriangle',
      color: 'from-rose-500 to-rose-600',
      lightBg: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'Needs PO Selection',
      value: needsPoSelectionCount.toLocaleString(),
      subtext: 'Invoices pending PO linkage',
      iconName: 'Link2',
      color: 'from-purple-500 to-purple-600',
      lightBg: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Purchase Orders',
      value: purchaseOrdersCount.toLocaleString(),
      subtext: `${goodsReceiptsCount} Goods Receipts (GR) recorded`,
      iconName: 'PackageCheck',
      color: 'from-blue-500 to-indigo-600',
      lightBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Master Vendors',
      value: vendorsCount.toLocaleString(),
      subtext: 'Approved vendor catalog',
      iconName: 'Users',
      color: 'from-indigo-500 to-indigo-600',
      lightBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Verified Commercial Value',
      value: formatCurrency(totalValidatedAmount, 'USD'),
      subtext: 'Total matched invoice value',
      iconName: 'TrendingUp',
      color: 'from-brand-500 to-brand-700',
      lightBg: 'bg-brand-50 text-brand-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-gray-500">Loading dashboard telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            Welcome back, {user?.name || 'there'}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Three-way invoice verification, Purchase Orders, and Goods Receipts overview.
          </p>
        </div>

        <DashboardActions />
      </div>

      {/* ─── Metric KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
              PO-Based Three-Way Verification Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Purchase Order • Goods Receipt (GRN) • Invoice
            </h2>
            <p className="text-sm text-navy-200 leading-relaxed">
              Every invoice is cross-checked against agreed Purchase Order prices and cumulative warehouse Goods Receipts. Billed quantities cannot exceed accepted quantities without administrative override.
            </p>
          </div>
          <Link to="/invoices/upload" className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-navy-900 hover:bg-gray-100 transition-colors shadow-sm">
              Upload & Verify Invoice
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
            <p className="text-xs text-gray-500 mt-0.5">Latest documents submitted for 3-way verification</p>
          </div>
          {totalCount > 0 && (
            <Link
              to="/invoices"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
            >
              View all
              <Icon name="ArrowRight" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </CardHeader>

        <CardBody className="p-0">
          {recentInvoices.length === 0 ? (
            <div className="p-6">
              <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
                  <Icon name="FileText" className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">No invoices uploaded yet</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
                  Upload PDF or image invoices to test Azure AI extraction, automated 3-way matching checks, and CSV export.
                </p>
                <Link to="/invoices/upload">
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
                    <th className="py-3 px-6">PO #</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Amount</th>
                    <th className="py-3 px-6">3-Way Match</th>
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
                        <td className="py-3.5 px-6 text-gray-500 font-mono text-xs">
                          {inv.poNumber || '—'}
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
                            to={`/invoices/${inv.id}`}
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
