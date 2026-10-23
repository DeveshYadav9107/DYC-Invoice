// ─────────────────────────────────────────────────────────────────
// Dashboard Controller — Aggregated Metrics, Trends & Status
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export async function getDashboardStats(req, res) {
  try {
    const user = req.user;
    const isAdmin = user.role === 'ADMIN';
    const orgId = user.organizationId;

    if (!isAdmin && !orgId) {
      return successResponse(res, {
        counts: { total: 0, validated: 0, needsReview: 0, rejected: 0, processing: 0 },
        totalAmount: 0,
        statusDistribution: [],
        monthlyTrend: [],
        recentInvoices: [],
      });
    }

    const where = (!isAdmin && orgId) ? { organizationId: orgId } : {};

    const [total, validated, needsReview, rejected, processing, amountSum, allInvoices, recents] =
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
        prisma.invoice.findMany({
          where,
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

    const statusDistribution = [
      { name: 'Validated', value: validated, color: '#10b981' },
      { name: 'Needs Review', value: needsReview, color: '#f59e0b' },
      { name: 'Processing', value: processing, color: '#0284c7' },
      { name: 'Rejected', value: rejected, color: '#ef4444' },
    ].filter((item) => item.value > 0);

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

    const serializedRecent = recents.map((inv) => ({
      ...inv,
      totalAmount: inv.totalAmount ? Number(inv.totalAmount) : 0,
      invoiceDate: inv.invoiceDate ? inv.invoiceDate.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
    }));

    return successResponse(res, {
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
      recentInvoices: serializedRecent,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return errorResponse(res, error.message || 'Failed to fetch dashboard stats.', 500);
  }
}
