// ─────────────────────────────────────────────────────────────────
// API Route: GET /api/dashboard/stats
// Aggregated metrics, trend series, and status breakdown
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    const orgId = user.organizationId;

    if (!orgId) {
      return apiResponse({
        counts: { total: 0, validated: 0, needsReview: 0, rejected: 0, processing: 0 },
        totalAmount: 0,
        statusDistribution: [],
        monthlyTrend: [],
      });
    }

    const where = { organizationId: orgId };

    const [total, validated, needsReview, rejected, processing, amountSum, allInvoices] =
      await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.count({ where: { ...where, validationStatus: 'VALIDATED' } }),
        prisma.invoice.count({ where: { ...where, validationStatus: 'NEEDS_REVIEW' } }),
        prisma.invoice.count({ where: { ...where, validationStatus: 'REJECTED' } }),
        prisma.invoice.count({
          where: {
            ...where,
            processingStatus: { in: ['UPLOADED', 'QUEUED', 'PROCESSING'] },
          },
        }),
        prisma.invoice.aggregate({
          where: { ...where, validationStatus: 'VALIDATED' },
          _sum: { totalAmount: true },
        }),
        prisma.invoice.findMany({
          where,
          select: {
            createdAt: true,
            totalAmount: true,
            validationStatus: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    // Status distribution for charts
    const statusDistribution = [
      { name: 'Validated', value: validated, color: '#10b981' },
      { name: 'Needs Review', value: needsReview, color: '#f59e0b' },
      { name: 'Processing', value: processing, color: '#3b82f6' },
      { name: 'Rejected', value: rejected, color: '#ef4444' },
    ].filter((item) => item.value > 0);

    // Group by month for trend chart
    const monthMap = new Map();
    allInvoices.forEach((inv) => {
      const monthKey = new Date(inv.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
      const current = monthMap.get(monthKey) || { month: monthKey, count: 0, amount: 0 };
      current.count += 1;
      current.amount += inv.totalAmount ? Number(inv.totalAmount) : 0;
      monthMap.set(monthKey, current);
    });

    const monthlyTrend = Array.from(monthMap.values());

    return apiResponse({
      counts: {
        total,
        validated,
        needsReview,
        rejected,
        processing,
      },
      totalAmount: amountSum._sum.totalAmount ? Number(amountSum._sum.totalAmount) : 0,
      statusDistribution,
      monthlyTrend,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return apiError(error.message || 'Failed to fetch dashboard stats.', 500);
  }
}
