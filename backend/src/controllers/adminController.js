// ─────────────────────────────────────────────────────────────────
// Admin Controller — System-wide telemetry & tenant administration
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * GET /api/admin/overview
 */
export async function getAdminOverview(req, res) {
  try {
    const [
      totalUsers,
      totalOrgs,
      totalInvoices,
      totalExports,
      totalVendors,
      totalPurchaseOrders,
      totalGoodsReceipts,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.invoice.count(),
      prisma.exportBatch.count(),
      prisma.vendor.count(),
      prisma.purchaseOrder.count(),
      prisma.goodsReceipt.count(),
      prisma.user.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { organization: true },
      }),
    ]);

    return successResponse(res, {
      totalUsers,
      totalOrgs,
      totalInvoices,
      totalExports,
      totalVendors,
      totalPurchaseOrders,
      totalGoodsReceipts,
      recentUsers,
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return errorResponse(res, error.message || 'Failed to fetch admin overview.', 500);
  }
}

/**
 * GET /api/admin/users
 */
export async function getAdminUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
        _count: { select: { uploadedInvoices: true } },
      },
    });

    return successResponse(res, { users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return errorResponse(res, error.message || 'Failed to fetch users list.', 500);
  }
}

/**
 * GET /api/admin/organizations
 */
export async function getAdminOrganizations(req, res) {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, invoices: true, exportBatches: true },
        },
      },
    });

    return successResponse(res, { organizations });
  } catch (error) {
    console.error('Error fetching admin organizations:', error);
    return errorResponse(res, error.message || 'Failed to fetch organizations list.', 500);
  }
}
