// ─────────────────────────────────────────────────────────────────
// Vendor Controller — Master Data Management for Vendors
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { normalizeKey } from '../utils/helpers.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * GET /api/vendors
 */
export async function getVendors(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const where = { organizationId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { vendorCode: { contains: search, mode: 'insensitive' } },
        { taxNumber: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, vendors] = await Promise.all([
      prisma.vendor.count({ where }),
      prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { purchaseOrders: true, invoices: true },
          },
        },
      }),
    ]);

    return successResponse(res, {
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return errorResponse(res, error.message || 'Failed to fetch vendors.', 500);
  }
}

/**
 * POST /api/vendors (Admin Only)
 */
export async function createVendor(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const { name, vendorCode, taxNumber, contactPerson, email, phone, address } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Vendor name is required.', 400);
    }

    // Auto-generate or validate unique vendorCode
    let code = vendorCode?.trim().toUpperCase();
    if (!code) {
      const count = await prisma.vendor.count({ where: { organizationId } });
      code = `VEN-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate code
    const existingCode = await prisma.vendor.findUnique({
      where: {
        organizationId_vendorCode: {
          organizationId,
          vendorCode: code,
        },
      },
    });

    if (existingCode) {
      return errorResponse(res, `Vendor with code "${code}" already exists in your organization.`, 409);
    }

    // Check duplicate vendor name
    const normalizedName = normalizeKey(name);
    const existingName = await prisma.vendor.findFirst({
      where: {
        organizationId,
        normalizedName,
      },
    });

    if (existingName) {
      return errorResponse(res, `A vendor named "${name.trim()}" already exists.`, 409);
    }

    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        vendorCode: code,
        name: name.trim(),
        normalizedName,
        taxNumber: taxNumber?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        isActive: true,
      },
    });

    await createAuditLog({
      organizationId,
      actorId: user.id,
      entityType: 'VENDOR',
      entityId: vendor.id,
      action: 'CREATED',
      metadata: { vendorCode: vendor.vendorCode, name: vendor.name },
    });

    return res.status(201).json({
      success: true,
      message: 'Vendor created successfully.',
      vendor,
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return errorResponse(res, error.message || 'Failed to create vendor.', 500);
  }
}

/**
 * GET /api/vendors/:id
 */
export async function getVendorById(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
            orderDate: true,
          },
        },
        _count: {
          select: { purchaseOrders: true, invoices: true },
        },
      },
    });

    if (!vendor || vendor.organizationId !== user.organizationId) {
      return errorResponse(res, 'Vendor not found.', 404);
    }

    return successResponse(res, { vendor });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return errorResponse(res, error.message || 'Failed to fetch vendor.', 500);
  }
}

/**
 * PATCH /api/vendors/:id (Admin Only)
 */
export async function updateVendor(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor || vendor.organizationId !== user.organizationId) {
      return errorResponse(res, 'Vendor not found.', 404);
    }

    const { name, taxNumber, contactPerson, email, phone, address, isActive } = req.body;
    const updateData = {};

    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
      updateData.normalizedName = normalizeKey(name);
    }
    if (taxNumber !== undefined) updateData.taxNumber = taxNumber?.trim() || null;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.vendor.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'VENDOR',
      entityId: id,
      action: 'UPDATED',
      metadata: { fields: Object.keys(updateData) },
    });

    return successResponse(res, { vendor: updated }, 'Vendor updated successfully.');
  } catch (error) {
    console.error('Error updating vendor:', error);
    return errorResponse(res, error.message || 'Failed to update vendor.', 500);
  }
}

/**
 * DELETE /api/vendors/:id (Admin Only)
 */
export async function deleteVendor(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchaseOrders: true, invoices: true },
        },
      },
    });

    if (!vendor || vendor.organizationId !== user.organizationId) {
      return errorResponse(res, 'Vendor not found.', 404);
    }

    // If vendor has transaction history, soft-deactivate instead of deleting
    if (vendor._count.purchaseOrders > 0 || vendor._count.invoices > 0) {
      const deactivated = await prisma.vendor.update({
        where: { id },
        data: { isActive: false },
      });
      return successResponse(res, { vendor: deactivated }, 'Vendor has associated transactional records and was deactivated.');
    }

    await prisma.vendor.delete({ where: { id } });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'VENDOR',
      entityId: id,
      action: 'DELETED',
      metadata: { vendorCode: vendor.vendorCode, name: vendor.name },
    });

    return successResponse(res, {}, 'Vendor deleted successfully.');
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return errorResponse(res, error.message || 'Failed to delete vendor.', 500);
  }
}
