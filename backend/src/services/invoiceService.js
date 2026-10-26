// ─────────────────────────────────────────────────────────────────
// Invoice Processing Pipeline & CRUD Service
// Integrated with PO-based Three-Way Verification Engine
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import Decimal from 'decimal.js';
import { getInvoiceFileBuffer } from './azureBlobStorage.js';
import { analyzeInvoiceDocument } from './documentExtraction.js';
import { runThreeWayVerification } from './threeWayVerification.js';
import { normalizeKey } from '../utils/helpers.js';
import { createAuditLog } from './auditLogService.js';

/**
 * Executes the full invoice processing lifecycle:
 * OCR Document Extraction -> PO/Vendor Auto-Matching -> Three-Way Verification.
 */
export async function processUploadedInvoice(invoiceId, fileBuffer = null) {
  try {
    // 1. Mark as PROCESSING
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { processingStatus: 'PROCESSING', processingError: null },
    });

    // 2. Fetch document buffer from storage if not already provided
    let buffer = fileBuffer;
    if (!buffer) {
      const storageResult = await getInvoiceFileBuffer(invoice.storageKey);
      buffer = storageResult.buffer;
    }

    // 3. Azure AI Document Intelligence Extraction
    const { extracted, confidence } = await analyzeInvoiceDocument(buffer);

    // 4. Classification determination
    let classificationStatus = 'INVOICE_CANDIDATE';
    if (!extracted.invoiceNumber && !extracted.totalAmount && confidence < 0.3) {
      classificationStatus = 'NOT_AN_INVOICE';
    }

    // 5. Auto-associate Purchase Order and Vendor if identified
    let matchedPoId = invoice.purchaseOrderId || null;
    let matchedVendorId = invoice.vendorId || null;

    if (!matchedPoId && extracted.purchaseOrderNumber) {
      const foundPo = await prisma.purchaseOrder.findFirst({
        where: {
          organizationId: invoice.organizationId,
          poNumber: { equals: extracted.purchaseOrderNumber.trim(), mode: 'insensitive' },
        },
      });

      if (foundPo) {
        matchedPoId = foundPo.id;
        if (!matchedVendorId) {
          matchedVendorId = foundPo.vendorId;
        }
      }
    }

    if (!matchedVendorId && extracted.vendorName) {
      const normVendor = normalizeKey(extracted.vendorName);
      const foundVendor = await prisma.vendor.findFirst({
        where: {
          organizationId: invoice.organizationId,
          OR: [
            { normalizedName: normVendor },
            extracted.vendorTaxNumber ? { taxNumber: extracted.vendorTaxNumber.trim() } : { id: 'none' },
          ],
        },
      });

      if (foundVendor) {
        matchedVendorId = foundVendor.id;
      }
    }

    // 6. Persist extracted fields & line items in a transaction
    await prisma.$transaction(async (tx) => {
      // Clear previous line items and issues
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
      await tx.validationIssue.deleteMany({ where: { invoiceId } });

      // Save line items
      if (extracted.lineItems && extracted.lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: extracted.lineItems.map((item) => ({
            invoiceId,
            description: item.description,
            quantity: item.quantity !== null && item.quantity !== undefined ? new Decimal(item.quantity) : null,
            unitPrice: item.unitPrice !== null && item.unitPrice !== undefined ? new Decimal(item.unitPrice) : null,
            taxAmount: item.taxAmount !== null && item.taxAmount !== undefined ? new Decimal(item.taxAmount) : null,
            totalAmount: item.totalAmount !== null && item.totalAmount !== undefined ? new Decimal(item.totalAmount) : null,
          })),
        });
      }

      // Update invoice record with extracted fields & linked IDs
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          processingStatus: 'COMPLETED',
          classificationStatus,
          vendorId: matchedVendorId,
          purchaseOrderId: matchedPoId,
          vendorName: extracted.vendorName,
          normalizedVendorName: normalizeKey(extracted.vendorName),
          vendorAddress: extracted.vendorAddress,
          vendorTaxNumber: extracted.vendorTaxNumber,
          customerName: extracted.customerName,
          customerAddress: extracted.customerAddress,
          invoiceNumber: extracted.invoiceNumber,
          normalizedInvoiceNumber: normalizeKey(extracted.invoiceNumber),
          invoiceDate: extracted.invoiceDate,
          dueDate: extracted.dueDate,
          purchaseOrderNumber: extracted.purchaseOrderNumber,
          currency: extracted.currency || 'USD',
          subtotal: extracted.subtotal !== null && extracted.subtotal !== undefined ? new Decimal(extracted.subtotal) : null,
          taxAmount: extracted.taxAmount !== null && extracted.taxAmount !== undefined ? new Decimal(extracted.taxAmount) : null,
          totalAmount: extracted.totalAmount !== null && extracted.totalAmount !== undefined ? new Decimal(extracted.totalAmount) : null,
          originalExtractedData: extracted,
          extractionConfidence: confidence,
        },
      });
    });

    // 7. Run authoritative Three-Way Verification against PO and GR
    await runThreeWayVerification(invoiceId);

    return { success: true };
  } catch (error) {
    console.error(`Error processing invoice ${invoiceId}:`, error);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        processingStatus: 'FAILED',
        processingError: error.message || 'Unknown processing error',
      },
    }).catch(console.error);

    return { success: false, error: error.message };
  }
}

/**
 * Re-runs Three-Way Verification for an existing invoice against PO + GR.
 */
export async function revalidateInvoice(invoiceId, user) {
  const result = await runThreeWayVerification(invoiceId, user);
  return { validationStatus: result.overallStatus, issues: result.issues, details: result };
}

/**
 * Links an invoice to a specific Purchase Order and automatically triggers 3-way verification.
 */
export async function linkInvoiceToPurchaseOrder(invoiceId, purchaseOrderId, user) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('Invoice not found.');

  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      organizationId: invoice.organizationId,
    },
    include: { vendor: true },
  });

  if (!po) {
    throw new Error('Purchase Order not found or not in your organization.');
  }

  // Update invoice with PO link and PO vendor
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      purchaseOrderId: po.id,
      purchaseOrderNumber: po.poNumber,
      vendorId: po.vendorId,
      ...(po.vendor?.name && !invoice.vendorName ? {
        vendorName: po.vendor.name,
        normalizedVendorName: normalizeKey(po.vendor.name),
      } : {}),
    },
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user?.id,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'LINKED_PURCHASE_ORDER',
    metadata: { poId: po.id, poNumber: po.poNumber },
  });

  return await runThreeWayVerification(invoiceId, user);
}

/**
 * Maps invoice line items to PO lines and re-runs verification.
 */
export async function mapInvoiceLineItems(invoiceId, lineMappings, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });

  if (!invoice) throw new Error('Invoice not found.');

  await prisma.$transaction(async (tx) => {
    for (const mapping of lineMappings) {
      if (mapping.invoiceLineId) {
        await tx.invoiceLineItem.update({
          where: { id: mapping.invoiceLineId },
          data: {
            poLineId: mapping.poLineId || null,
            itemId: mapping.itemId || null,
          },
        });
      }
    }
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user?.id,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'MAPPED_LINE_ITEMS',
    metadata: { mappingsCount: lineMappings.length },
  });

  return await runThreeWayVerification(invoiceId, user);
}

/**
 * Admin manual override/approval for an invoice with exceptions.
 */
export async function overrideInvoiceException(invoiceId, overrideReason, user) {
  if (user?.role !== 'ADMIN') {
    throw new Error('Only administrators can approve or override invoice exceptions.');
  }

  if (!overrideReason || !overrideReason.trim()) {
    throw new Error('An audit reason is required to override verification exceptions.');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) throw new Error('Invoice not found.');

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        validationStatus: 'MATCHED',
        verificationSummary: {
          ...(invoice.verificationSummary || {}),
          overallStatus: 'MATCHED',
          isOverridden: true,
          overrideReason: overrideReason.trim(),
          overriddenBy: user.id,
          overriddenAt: new Date().toISOString(),
        },
      },
    });

    await tx.invoiceVerification.create({
      data: {
        invoiceId,
        purchaseOrderId: invoice.purchaseOrderId,
        performedById: user.id,
        overallStatus: 'MATCHED',
        vendorMatch: true,
        poMatch: true,
        quantityMatch: true,
        priceMatch: true,
        taxMatch: true,
        duplicateCheck: true,
        discrepancyCount: 0,
        overrideReason: overrideReason.trim(),
        details: {
          note: 'Manually approved / overridden by administrator.',
          overrideReason: overrideReason.trim(),
          overriddenBy: user.email,
        },
      },
    });
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user.id,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'EXCEPTION_OVERRIDDEN',
    metadata: { overrideReason: overrideReason.trim() },
  });

  return { success: true, validationStatus: 'MATCHED' };
}

/**
 * Applies manual corrections to header/amounts and triggers 3-way re-verification.
 */
export async function updateInvoiceCorrections(invoiceId, body, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  const updateData = {};
  if (body.vendorName !== undefined) {
    updateData.vendorName = body.vendorName?.trim() || null;
    updateData.normalizedVendorName = normalizeKey(body.vendorName);
  }
  if (body.invoiceNumber !== undefined) {
    updateData.invoiceNumber = body.invoiceNumber?.trim() || null;
    updateData.normalizedInvoiceNumber = normalizeKey(body.invoiceNumber);
  }
  if (body.invoiceDate !== undefined) updateData.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.currency !== undefined) updateData.currency = body.currency?.trim() || 'USD';
  if (body.purchaseOrderId !== undefined) updateData.purchaseOrderId = body.purchaseOrderId || null;

  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal ? new Decimal(body.subtotal) : null;
  if (body.taxAmount !== undefined) updateData.taxAmount = body.taxAmount ? new Decimal(body.taxAmount) : null;
  if (body.discountAmount !== undefined) updateData.discountAmount = body.discountAmount ? new Decimal(body.discountAmount) : null;
  if (body.additionalCharges !== undefined) updateData.additionalCharges = body.additionalCharges ? new Decimal(body.additionalCharges) : null;
  if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount ? new Decimal(body.totalAmount) : null;

  updateData.correctedData = {
    ...(invoice.correctedData || {}),
    lastUpdated: new Date().toISOString(),
    updatedBy: user.id,
    fields: body,
  };

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user.id,
    entityType: 'INVOICE',
    entityId: invoice.id,
    action: 'CORRECTED',
    metadata: { fields: Object.keys(body) },
  });

  // Re-run 3-way verification with updated values
  await runThreeWayVerification(invoiceId, user);

  return await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      validationIssues: true,
      vendor: true,
      purchaseOrder: {
        include: {
          vendor: true,
          lines: true,
          goodsReceipts: {
            include: { lines: true },
          },
        },
      },
    },
  });
}
