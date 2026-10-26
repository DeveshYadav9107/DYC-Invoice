// ─────────────────────────────────────────────────────────────────
// Item Controller — Master Data Management for Products / Items
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import Decimal from 'decimal.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * GET /api/items
 */
export async function getItems(req, res) {
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
        { itemCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        skip,
        take: limit,
        orderBy: { itemCode: 'asc' },
        include: {
          _count: {
            select: { poLines: true },
          },
        },
      }),
    ]);

    return successResponse(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return errorResponse(res, error.message || 'Failed to fetch items.', 500);
  }
}

/**
 * POST /api/items (Admin Only)
 */
export async function createItem(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const { itemCode, name, description, uom, unitPrice, taxRate } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Item name is required.', 400);
    }

    let code = itemCode?.trim().toUpperCase();
    if (!code) {
      const count = await prisma.item.count({ where: { organizationId } });
      code = `SKU-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate code
    const existingCode = await prisma.item.findUnique({
      where: {
        organizationId_itemCode: {
          organizationId,
          itemCode: code,
        },
      },
    });

    if (existingCode) {
      return errorResponse(res, `Item with SKU / Code "${code}" already exists in your organization.`, 409);
    }

    const item = await prisma.item.create({
      data: {
        organizationId,
        itemCode: code,
        name: name.trim(),
        description: description?.trim() || null,
        uom: (uom?.trim() || 'PCS').toUpperCase(),
        unitPrice: unitPrice !== undefined && unitPrice !== null && unitPrice !== '' ? new Decimal(unitPrice) : null,
        taxRate: taxRate !== undefined && taxRate !== null && taxRate !== '' ? new Decimal(taxRate) : null,
        isActive: true,
      },
    });

    await createAuditLog({
      organizationId,
      actorId: user.id,
      entityType: 'ITEM',
      entityId: item.id,
      action: 'CREATED',
      metadata: { itemCode: item.itemCode, name: item.name },
    });

    return res.status(201).json({
      success: true,
      message: 'Item created successfully.',
      item,
    });
  } catch (error) {
    console.error('Error creating item:', error);
    return errorResponse(res, error.message || 'Failed to create item.', 500);
  }
}

/**
 * GET /api/items/:id
 */
export async function getItemById(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        _count: {
          select: { poLines: true },
        },
      },
    });

    if (!item || item.organizationId !== user.organizationId) {
      return errorResponse(res, 'Item not found.', 404);
    }

    return successResponse(res, { item });
  } catch (error) {
    console.error('Error fetching item:', error);
    return errorResponse(res, error.message || 'Failed to fetch item.', 500);
  }
}

/**
 * PATCH /api/items/:id (Admin Only)
 */
export async function updateItem(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item || item.organizationId !== user.organizationId) {
      return errorResponse(res, 'Item not found.', 404);
    }

    const { name, description, uom, unitPrice, taxRate, isActive } = req.body;
    const updateData = {};

    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (uom !== undefined && uom.trim()) updateData.uom = uom.trim().toUpperCase();
    if (unitPrice !== undefined) {
      updateData.unitPrice = unitPrice !== null && unitPrice !== '' ? new Decimal(unitPrice) : null;
    }
    if (taxRate !== undefined) {
      updateData.taxRate = taxRate !== null && taxRate !== '' ? new Decimal(taxRate) : null;
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.item.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'ITEM',
      entityId: id,
      action: 'UPDATED',
      metadata: { fields: Object.keys(updateData) },
    });

    return successResponse(res, { item: updated }, 'Item updated successfully.');
  } catch (error) {
    console.error('Error updating item:', error);
    return errorResponse(res, error.message || 'Failed to update item.', 500);
  }
}

/**
 * DELETE /api/items/:id (Admin Only)
 */
export async function deleteItem(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        _count: { select: { poLines: true } },
      },
    });

    if (!item || item.organizationId !== user.organizationId) {
      return errorResponse(res, 'Item not found.', 404);
    }

    if (item._count.poLines > 0) {
      const deactivated = await prisma.item.update({
        where: { id },
        data: { isActive: false },
      });
      return successResponse(res, { item: deactivated }, 'Item is referenced on Purchase Orders and was deactivated.');
    }

    await prisma.item.delete({ where: { id } });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'ITEM',
      entityId: id,
      action: 'DELETED',
      metadata: { itemCode: item.itemCode, name: item.name },
    });

    return successResponse(res, {}, 'Item deleted successfully.');
  } catch (error) {
    console.error('Error deleting item:', error);
    return errorResponse(res, error.message || 'Failed to delete item.', 500);
  }
}
