// ─────────────────────────────────────────────────────────────────
// Purchase Order Controller — PO Creation, Lines & Lifecycle
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import Decimal from 'decimal.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * GET /api/purchase-orders
 */
export async function getPurchaseOrders(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const status = req.query.status;
    const vendorId = req.query.vendorId;
    const search = req.query.search?.trim();

    const where = { organizationId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (vendorId && vendorId !== 'ALL') {
      where.vendorId = vendorId;
    }

    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, purchaseOrders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: { id: true, name: true, vendorCode: true, taxNumber: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { lines: true, goodsReceipts: true, invoices: true },
          },
        },
      }),
    ]);

    return successResponse(res, {
      purchaseOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return errorResponse(res, error.message || 'Failed to fetch purchase orders.', 500);
  }
}

/**
 * POST /api/purchase-orders (Admin Only)
 */
export async function createPurchaseOrder(req, res) {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    if (!organizationId) {
      return errorResponse(res, 'Organization assignment required.', 403);
    }

    const {
      poNumber,
      vendorId,
      orderDate,
      expectedDeliveryDate,
      currency = 'USD',
      lines = [],
      notes,
      terms,
      additionalCharges = 0,
      autoIssue = false,
    } = req.body;

    if (!vendorId) {
      return errorResponse(res, 'Vendor selection is required.', 400);
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId, isActive: true },
    });

    if (!vendor) {
      return errorResponse(res, 'Selected vendor not found or is inactive.', 404);
    }

    if (!lines || lines.length === 0) {
      return errorResponse(res, 'At least one line item is required.', 400);
    }

    // Auto-generate or validate unique PO Number
    let number = poNumber?.trim().toUpperCase();
    if (!number) {
      const year = new Date().getFullYear();
      const count = await prisma.purchaseOrder.count({ where: { organizationId } });
      number = `PO-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const existingPo = await prisma.purchaseOrder.findUnique({
      where: {
        organizationId_poNumber: {
          organizationId,
          poNumber: number,
        },
      },
    });

    if (existingPo) {
      return errorResponse(res, `Purchase Order number "${number}" already exists in your organization.`, 409);
    }

    // Calculate line totals and PO totals with Decimal precision
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = new Decimal(0);

    const validatedLines = [];
    let lineIdx = 1;

    for (const line of lines) {
      const orderedQty = new Decimal(line.orderedQuantity || 0);
      const unitPrice = new Decimal(line.unitPrice || 0);
      const discountPct = new Decimal(line.discountPercent || 0);
      const taxRate = new Decimal(line.taxRate || 0);

      if (orderedQty.lessThanOrEqualTo(0)) {
        return errorResponse(res, `Line ${lineIdx}: Ordered quantity must be greater than zero.`, 400);
      }
      if (unitPrice.lessThan(0)) {
        return errorResponse(res, `Line ${lineIdx}: Unit price cannot be negative.`, 400);
      }

      // Calculations:
      // Line Gross = Qty * UnitPrice
      const lineGross = orderedQty.mul(unitPrice);
      // Line Discount = Gross * (Discount% / 100)
      const lineDisc = lineGross.mul(discountPct.div(100));
      const lineNet = lineGross.minus(lineDisc);
      // Line Tax = Net * (Tax% / 100)
      const lineTax = lineNet.mul(taxRate.div(100));
      const lineTotal = lineNet.plus(lineTax);

      subtotal = subtotal.plus(lineGross);
      totalDiscount = totalDiscount.plus(lineDisc);
      totalTax = totalTax.plus(lineTax);

      validatedLines.push({
        lineNumber: lineIdx++,
        itemId: line.itemId || null,
        itemCode: line.itemCode?.trim() || null,
        description: line.description?.trim() || 'Item',
        uom: (line.uom?.trim() || 'PCS').toUpperCase(),
        orderedQuantity: orderedQty,
        unitPrice,
        discountPercent: discountPct,
        taxRate,
        lineTotal,
      });
    }

    const addCharges = new Decimal(additionalCharges || 0);
    const grandTotal = subtotal.minus(totalDiscount).plus(totalTax).plus(addCharges);

    const initialStatus = autoIssue ? 'ISSUED' : 'DRAFT';

    const po = await prisma.$transaction(async (tx) => {
      const createdPo = await tx.purchaseOrder.create({
        data: {
          organizationId,
          poNumber: number,
          vendorId: vendor.id,
          createdById: user.id,
          status: initialStatus,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          currency: (currency || 'USD').toUpperCase(),
          subtotal,
          taxAmount: totalTax,
          discountAmount: totalDiscount,
          additionalCharges: addCharges,
          totalAmount: grandTotal,
          notes: notes?.trim() || null,
          terms: terms?.trim() || null,
          lines: {
            create: validatedLines,
          },
        },
        include: {
          vendor: true,
          lines: {
            include: { item: true },
          },
        },
      });

      return createdPo;
    });

    await createAuditLog({
      organizationId,
      actorId: user.id,
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      action: autoIssue ? 'CREATED_AND_ISSUED' : 'CREATED',
      metadata: { poNumber: po.poNumber, total: grandTotal.toNumber() },
    });

    return res.status(201).json({
      success: true,
      message: `Purchase Order ${po.poNumber} created successfully.`,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return errorResponse(res, error.message || 'Failed to create purchase order.', 500);
  }
}

/**
 * GET /api/purchase-orders/:id
 */
export async function getPurchaseOrderById(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        lines: {
          orderBy: { lineNumber: 'asc' },
          include: {
            item: true,
            grLines: {
              include: { goodsReceipt: true },
            },
          },
        },
        goodsReceipts: {
          orderBy: { receiptDate: 'desc' },
          include: {
            receivedBy: { select: { id: true, name: true } },
            lines: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            validationStatus: true,
            originalFileName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!po || po.organizationId !== user.organizationId) {
      return errorResponse(res, 'Purchase Order not found.', 404);
    }

    // Compute cumulative accepted, invoiced, and remaining billable quantities per line
    const matchedInvoices = await prisma.invoice.findMany({
      where: {
        purchaseOrderId: po.id,
        validationStatus: 'MATCHED',
      },
      include: { lineItems: true },
    });

    const invoicedQtyMap = new Map();
    for (const inv of matchedInvoices) {
      for (const item of inv.lineItems) {
        if (item.poLineId && item.quantity) {
          const cur = invoicedQtyMap.get(item.poLineId) || new Decimal(0);
          invoicedQtyMap.set(item.poLineId, cur.plus(new Decimal(item.quantity)));
        }
      }
    }

    const enhancedLines = po.lines.map((line) => {
      let cumulativeReceived = new Decimal(0);
      let cumulativeAccepted = new Decimal(0);
      let cumulativeRejected = new Decimal(0);

      for (const grLine of line.grLines || []) {
        if (grLine.goodsReceipt?.status === 'SUBMITTED') {
          cumulativeReceived = cumulativeReceived.plus(new Decimal(grLine.receivedQuantity || 0));
          cumulativeAccepted = cumulativeAccepted.plus(new Decimal(grLine.acceptedQuantity || 0));
          cumulativeRejected = cumulativeRejected.plus(new Decimal(grLine.rejectedQuantity || 0));
        }
      }

      const invoicedQty = invoicedQtyMap.get(line.id) || new Decimal(0);
      const remainingUnreceived = Decimal.max(0, new Decimal(line.orderedQuantity).minus(cumulativeAccepted));
      const remainingBillable = Decimal.max(0, cumulativeAccepted.minus(invoicedQty));

      return {
        ...line,
        cumulativeReceivedQuantity: cumulativeReceived.toNumber(),
        cumulativeAcceptedQuantity: cumulativeAccepted.toNumber(),
        cumulativeRejectedQuantity: cumulativeRejected.toNumber(),
        invoicedQuantity: invoicedQty.toNumber(),
        remainingToReceive: remainingUnreceived.toNumber(),
        remainingBillableQuantity: remainingBillable.toNumber(),
      };
    });

    return successResponse(res, {
      purchaseOrder: {
        ...po,
        lines: enhancedLines,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase order details:', error);
    return errorResponse(res, error.message || 'Failed to fetch purchase order details.', 500);
  }
}

/**
 * PATCH /api/purchase-orders/:id (Admin Only — Edit Draft PO)
 */
export async function updatePurchaseOrder(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!po || po.organizationId !== user.organizationId) {
      return errorResponse(res, 'Purchase Order not found.', 404);
    }

    // Controlled edit restriction: prevent silent modification if already issued
    if (po.status !== 'DRAFT') {
      return errorResponse(
        res,
        `Cannot directly edit Purchase Order in "${po.status}" status. Only DRAFT orders can be modified.`,
        400
      );
    }

    const {
      expectedDeliveryDate,
      currency,
      notes,
      terms,
      additionalCharges,
      lines,
    } = req.body;

    const updateData = {};
    if (expectedDeliveryDate !== undefined) {
      updateData.expectedDeliveryDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : null;
    }
    if (currency !== undefined) updateData.currency = currency.trim().toUpperCase();
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (terms !== undefined) updateData.terms = terms?.trim() || null;

    let grandTotal = po.totalAmount;

    await prisma.$transaction(async (tx) => {
      if (lines && Array.isArray(lines)) {
        // Re-calculate line totals
        let subtotal = new Decimal(0);
        let totalTax = new Decimal(0);
        let totalDiscount = new Decimal(0);

        const newLines = [];
        let lineIdx = 1;

        for (const line of lines) {
          const orderedQty = new Decimal(line.orderedQuantity || 0);
          const unitPrice = new Decimal(line.unitPrice || 0);
          const discountPct = new Decimal(line.discountPercent || 0);
          const taxRate = new Decimal(line.taxRate || 0);

          const lineGross = orderedQty.mul(unitPrice);
          const lineDisc = lineGross.mul(discountPct.div(100));
          const lineNet = lineGross.minus(lineDisc);
          const lineTax = lineNet.mul(taxRate.div(100));
          const lineTotal = lineNet.plus(lineTax);

          subtotal = subtotal.plus(lineGross);
          totalDiscount = totalDiscount.plus(lineDisc);
          totalTax = totalTax.plus(lineTax);

          newLines.push({
            lineNumber: lineIdx++,
            itemId: line.itemId || null,
            itemCode: line.itemCode?.trim() || null,
            description: line.description?.trim() || 'Item',
            uom: (line.uom?.trim() || 'PCS').toUpperCase(),
            orderedQuantity: orderedQty,
            unitPrice,
            discountPercent: discountPct,
            taxRate,
            lineTotal,
          });
        }

        const addCharges = new Decimal(additionalCharges !== undefined ? additionalCharges : po.additionalCharges || 0);
        grandTotal = subtotal.minus(totalDiscount).plus(totalTax).plus(addCharges);

        updateData.subtotal = subtotal;
        updateData.taxAmount = totalTax;
        updateData.discountAmount = totalDiscount;
        updateData.additionalCharges = addCharges;
        updateData.totalAmount = grandTotal;

        // Replace lines
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
        updateData.lines = { create: newLines };
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: updateData,
      });
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'UPDATED',
      metadata: { poNumber: po.poNumber },
    });

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true, vendor: true },
    });

    return successResponse(res, { purchaseOrder: updated }, 'Purchase Order updated successfully.');
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return errorResponse(res, error.message || 'Failed to update purchase order.', 500);
  }
}

/**
 * POST /api/purchase-orders/:id/issue (Admin Only — Issue PO to Vendor)
 */
export async function issuePurchaseOrder(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po || po.organizationId !== user.organizationId) {
      return errorResponse(res, 'Purchase Order not found.', 404);
    }

    if (po.status !== 'DRAFT') {
      return errorResponse(res, `Purchase Order is already in "${po.status}" status.`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ISSUED' },
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'ISSUED',
      metadata: { poNumber: po.poNumber },
    });

    return successResponse(res, { purchaseOrder: updated }, `Purchase Order ${po.poNumber} has been officially ISSUED.`);
  } catch (error) {
    console.error('Error issuing purchase order:', error);
    return errorResponse(res, error.message || 'Failed to issue purchase order.', 500);
  }
}

/**
 * POST /api/purchase-orders/:id/close (Admin Only)
 */
export async function closePurchaseOrder(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po || po.organizationId !== user.organizationId) {
      return errorResponse(res, 'Purchase Order not found.', 404);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'CLOSED',
      metadata: { poNumber: po.poNumber },
    });

    return successResponse(res, { purchaseOrder: updated }, `Purchase Order ${po.poNumber} has been CLOSED.`);
  } catch (error) {
    console.error('Error closing purchase order:', error);
    return errorResponse(res, error.message || 'Failed to close purchase order.', 500);
  }
}

/**
 * POST /api/purchase-orders/:id/cancel (Admin Only)
 */
export async function cancelPurchaseOrder(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        goodsReceipts: { where: { status: 'SUBMITTED' } },
        invoices: true,
      },
    });

    if (!po || po.organizationId !== user.organizationId) {
      return errorResponse(res, 'Purchase Order not found.', 404);
    }

    if (po.goodsReceipts.length > 0 || po.invoices.length > 0) {
      return errorResponse(
        res,
        'Cannot cancel a Purchase Order that has active Goods Receipts or linked Invoices.',
        400
      );
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      action: 'CANCELLED',
      metadata: { poNumber: po.poNumber },
    });

    return successResponse(res, { purchaseOrder: updated }, `Purchase Order ${po.poNumber} has been CANCELLED.`);
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    return errorResponse(res, error.message || 'Failed to cancel purchase order.', 500);
  }
}
