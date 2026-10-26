// ─────────────────────────────────────────────────────────────────
// Goods Receipt (GR / GRN) Controller — Physical Delivery Tracking
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import Decimal from 'decimal.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * GET /api/goods-receipts
 */
export async function getGoodsReceipts(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const purchaseOrderId = req.query.purchaseOrderId;
    const search = req.query.search?.trim();

    const where = { organizationId };

    if (purchaseOrderId && purchaseOrderId !== 'ALL') {
      where.purchaseOrderId = purchaseOrderId;
    }

    if (search) {
      where.OR = [
        { grnNumber: { contains: search, mode: 'insensitive' } },
        { deliveryNoteNumber: { contains: search, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
        { purchaseOrder: { vendor: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, goodsReceipts] = await Promise.all([
      prisma.goodsReceipt.count({ where }),
      prisma.goodsReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receiptDate: 'desc' },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              vendor: { select: { id: true, name: true, vendorCode: true } },
            },
          },
          receivedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { lines: true },
          },
        },
      }),
    ]);

    return successResponse(res, {
      goodsReceipts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching goods receipts:', error);
    return errorResponse(res, error.message || 'Failed to fetch goods receipts.', 500);
  }
}

/**
 * POST /api/goods-receipts (Admin Only)
 */
export async function createGoodsReceipt(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const {
      grnNumber,
      purchaseOrderId,
      receiptDate,
      deliveryNoteNumber,
      carrierReference,
      remarks,
      lines = [],
    } = req.body;

    if (!purchaseOrderId) {
      return errorResponse(res, 'A Purchase Order must be selected to record a Goods Receipt.', 400);
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        lines: {
          include: {
            grLines: {
              include: { goodsReceipt: true },
            },
          },
        },
      },
    });

    if (!po || po.organizationId !== organizationId) {
      return errorResponse(res, 'Selected Purchase Order not found in your organization.', 404);
    }

    if (po.status === 'DRAFT') {
      return errorResponse(res, 'Goods cannot be received against a DRAFT Purchase Order. Please issue the PO first.', 400);
    }

    if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
      return errorResponse(res, `Cannot receive goods against a ${po.status} Purchase Order.`, 400);
    }

    if (!lines || lines.length === 0) {
      return errorResponse(res, 'At least one receipt line item is required.', 400);
    }

    // Auto-generate or validate unique GRN number
    let number = grnNumber?.trim().toUpperCase();
    if (!number) {
      const year = new Date().getFullYear();
      const count = await prisma.goodsReceipt.count({ where: { organizationId } });
      number = `GRN-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const existingGr = await prisma.goodsReceipt.findUnique({
      where: {
        organizationId_grnNumber: {
          organizationId,
          grnNumber: number,
        },
      },
    });

    if (existingGr) {
      return errorResponse(res, `Goods Receipt number "${number}" already exists in your organization.`, 409);
    }

    // Validate quantities against PO ordered and cumulative accepted
    const poLinesMap = new Map(po.lines.map((l) => [l.id, l]));
    const validatedGrLines = [];
    let hasAcceptedGoods = false;

    for (const line of lines) {
      const poLine = poLinesMap.get(line.poLineId);
      if (!poLine) {
        return errorResponse(res, `Invalid PO line ID "${line.poLineId}". Must belong to PO ${po.poNumber}.`, 400);
      }

      const receivedQty = new Decimal(line.receivedQuantity || 0);
      const acceptedQty = new Decimal(line.acceptedQuantity !== undefined ? line.acceptedQuantity : line.receivedQuantity || 0);
      const rejectedQty = new Decimal(line.rejectedQuantity || 0);

      if (receivedQty.lessThan(0) || acceptedQty.lessThan(0)) {
        return errorResponse(res, `Item "${poLine.description}": Received and accepted quantities cannot be negative.`, 400);
      }

      if (acceptedQty.plus(rejectedQty).greaterThan(receivedQty)) {
        return errorResponse(
          res,
          `Item "${poLine.description}": Accepted quantity (${acceptedQty}) + Rejected (${rejectedQty}) cannot exceed total received quantity (${receivedQty}).`,
          400
        );
      }

      // Compute existing cumulative accepted across all submitted GRs
      let existingAccepted = new Decimal(0);
      for (const prevGrLine of poLine.grLines || []) {
        if (prevGrLine.goodsReceipt?.status === 'SUBMITTED') {
          existingAccepted = existingAccepted.plus(new Decimal(prevGrLine.acceptedQuantity || 0));
        }
      }

      const orderedQty = new Decimal(poLine.orderedQuantity);
      const remainingToReceive = orderedQty.minus(existingAccepted);

      // Business rule: Prevent receipt quantities from exceeding remaining ordered quantity
      if (acceptedQty.greaterThan(remainingToReceive)) {
        return errorResponse(
          res,
          `Item "${poLine.description}": Accepted quantity (${acceptedQty}) exceeds remaining ordered quantity (${remainingToReceive}). Total Ordered: ${orderedQty}, Previously Accepted: ${existingAccepted}. Over-receipts are not permitted.`,
          400
        );
      }

      if (acceptedQty.greaterThan(0)) {
        hasAcceptedGoods = true;
      }

      validatedGrLines.push({
        poLineId: poLine.id,
        receivedQuantity: receivedQty,
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty,
        rejectionReason: line.rejectionReason?.trim() || null,
      });
    }

    if (!hasAcceptedGoods && validatedGrLines.every((l) => l.receivedQuantity.isZero())) {
      return errorResponse(res, 'Cannot record a Goods Receipt with zero received items.', 400);
    }

    // Save GR and update PO receipt status in a transaction
    const gr = await prisma.$transaction(async (tx) => {
      const createdGr = await tx.goodsReceipt.create({
        data: {
          organizationId,
          grnNumber: number,
          purchaseOrderId: po.id,
          receivedById: user.id,
          receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
          deliveryNoteNumber: deliveryNoteNumber?.trim() || null,
          carrierReference: carrierReference?.trim() || null,
          remarks: remarks?.trim() || null,
          status: 'SUBMITTED',
          lines: {
            create: validatedGrLines,
          },
        },
        include: {
          lines: {
            include: { poLine: true },
          },
          purchaseOrder: true,
        },
      });

      // Recalculate PO cumulative receipts to update PO status
      const allPoGrLines = await tx.goodsReceiptLine.findMany({
        where: {
          goodsReceipt: {
            purchaseOrderId: po.id,
            status: 'SUBMITTED',
          },
        },
      });

      const totalAcceptedPerPoLine = new Map();
      for (const l of allPoGrLines) {
        const cur = totalAcceptedPerPoLine.get(l.poLineId) || new Decimal(0);
        totalAcceptedPerPoLine.set(l.poLineId, cur.plus(new Decimal(l.acceptedQuantity || 0)));
      }

      let allFullyAccepted = true;
      let anyAccepted = false;

      for (const pl of po.lines) {
        const acc = totalAcceptedPerPoLine.get(pl.id) || new Decimal(0);
        if (acc.greaterThan(0)) anyAccepted = true;
        if (acc.lessThan(new Decimal(pl.orderedQuantity))) {
          allFullyAccepted = false;
        }
      }

      let newPoStatus = po.status;
      if (allFullyAccepted) {
        newPoStatus = 'FULLY_RECEIVED';
      } else if (anyAccepted) {
        newPoStatus = 'PARTIALLY_RECEIVED';
      }

      if (newPoStatus !== po.status) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: newPoStatus },
        });
      }

      return createdGr;
    });

    await createAuditLog({
      organizationId,
      actorId: user.id,
      entityType: 'GOODS_RECEIPT',
      entityId: gr.id,
      action: 'CREATED',
      metadata: { grnNumber: gr.grnNumber, poNumber: po.poNumber },
    });

    return res.status(201).json({
      success: true,
      message: `Goods Receipt ${gr.grnNumber} submitted successfully.`,
      goodsReceipt: gr,
    });
  } catch (error) {
    console.error('Error creating goods receipt:', error);
    return errorResponse(res, error.message || 'Failed to create goods receipt.', 500);
  }
}

/**
 * GET /api/goods-receipts/:id
 */
export async function getGoodsReceiptById(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const gr = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
          },
        },
        receivedBy: {
          select: { id: true, name: true, email: true },
        },
        lines: {
          include: {
            poLine: {
              include: { item: true },
            },
          },
        },
      },
    });

    if (!gr || gr.organizationId !== user.organizationId) {
      return errorResponse(res, 'Goods Receipt not found.', 404);
    }

    return successResponse(res, { goodsReceipt: gr });
  } catch (error) {
    console.error('Error fetching goods receipt:', error);
    return errorResponse(res, error.message || 'Failed to fetch goods receipt.', 500);
  }
}

/**
 * DELETE /api/goods-receipts/:id (Admin Only — Cancel GR if not verified)
 */
export async function deleteGoodsReceipt(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const gr = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            invoices: {
              where: { validationStatus: 'MATCHED' },
            },
          },
        },
      },
    });

    if (!gr || gr.organizationId !== user.organizationId) {
      return errorResponse(res, 'Goods Receipt not found.', 404);
    }

    // Business rule: Prevent deletion or modification of receipt records already used by verified invoices
    if (gr.purchaseOrder?.invoices.length > 0) {
      return errorResponse(
        res,
        'Cannot cancel or delete this Goods Receipt because verified invoices exist against its Purchase Order.',
        400
      );
    }

    await prisma.goodsReceipt.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'GOODS_RECEIPT',
      entityId: id,
      action: 'CANCELLED',
      metadata: { grnNumber: gr.grnNumber },
    });

    return successResponse(res, {}, `Goods Receipt ${gr.grnNumber} has been cancelled.`);
  } catch (error) {
    console.error('Error deleting goods receipt:', error);
    return errorResponse(res, error.message || 'Failed to delete goods receipt.', 500);
  }
}
