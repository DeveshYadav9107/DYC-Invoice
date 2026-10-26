// ─────────────────────────────────────────────────────────────────
// Dashboard Controller — Aggregated Metrics, Trends & 3-Way Status
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
        counts: {
          total: 0,
          matched: 0,
          mismatched: 0,
          needsPoSelection: 0,
          needsReview: 0,
          processing: 0,
          vendors: 0,
          purchaseOrders: 0,
          goodsReceipts: 0,
        },
        totalAmount: 0,
        statusDistribution: [],
        monthlyTrend: [],
        recentInvoices: [],
      });
    }

    const where = (!isAdmin && orgId) ? { organizationId: orgId } : (orgId ? { organizationId: orgId } : {});

    const [
      total,
      matched,
      mismatched,
      needsPoSelection,
      needsReview,
      processing,
      amountSum,
      allInvoices,
      recents,
      vendorsCount,
      posCount,
      grsCount,
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.count({
        where: { ...where, validationStatus: { in: ['MATCHED', 'VALIDATED'] } },
      }),
      prisma.invoice.count({
        where: { ...where, validationStatus: { in: ['MISMATCH', 'REJECTED'] } },
      }),
      prisma.invoice.count({
        where: { ...where, validationStatus: 'NEEDS_PO_SELECTION' },
      }),
      prisma.invoice.count({
        where: { ...where, validationStatus: 'NEEDS_REVIEW' },
      }),
      prisma.invoice.count({
        where: {
          ...where,
          processingStatus: { in: ['UPLOADED', 'QUEUED', 'PROCESSING'] },
        },
      }),
      prisma.invoice.aggregate({
        where: { ...where, validationStatus: { in: ['MATCHED', 'VALIDATED'] } },
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
          purchaseOrderNumber: true,
          purchaseOrder: { select: { poNumber: true } },
          createdAt: true,
        },
      }),
      prisma.vendor.count({ where }),
      prisma.purchaseOrder.count({ where }),
      prisma.goodsReceipt.count({ where }),
    ]);

    const statusDistribution = [
      { name: 'Matched', value: matched, color: '#10b981' },
      { name: 'Mismatch / Exceptions', value: mismatched, color: '#ef4444' },
      { name: 'Needs PO Selection', value: needsPoSelection, color: '#8b5cf6' },
      { name: 'Needs Review', value: needsReview, color: '#f59e0b' },
      { name: 'Processing', value: processing, color: '#0284c7' },
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
      poNumber: inv.purchaseOrder?.poNumber || inv.purchaseOrderNumber || '—',
      totalAmount: inv.totalAmount ? Number(inv.totalAmount) : 0,
      invoiceDate: inv.invoiceDate ? inv.invoiceDate.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
    }));

    return successResponse(res, {
      counts: {
        total,
        matched,
        validated: matched, // for backward-compatible frontend references
        mismatched,
        needsPoSelection,
        needsReview,
        processing,
        vendors: vendorsCount,
        purchaseOrders: posCount,
        goodsReceipts: grsCount,
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
