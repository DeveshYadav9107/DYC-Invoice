// ─────────────────────────────────────────────────────────────────
// Invoice Processing Pipeline & CRUD Service
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import Decimal from 'decimal.js';
import { getInvoiceFileBuffer } from './azureBlobStorage.js';
import { analyzeInvoiceDocument } from './documentExtraction.js';
import { validateInvoiceData } from './invoiceValidation.js';
import { normalizeKey } from '../utils/helpers.js';
import { createAuditLog } from './auditLogService.js';

/**
 * Executes the full invoice processing lifecycle: OCR + Classification + Validation.
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

    // 5. Run validation rules
    const validationResult = await validateInvoiceData(
      extracted,
      invoice.organizationId,
      invoiceId
    );

    // 6. Persist extracted data, line items, and issues in a transaction
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

      // Save validation issues
      if (validationResult.issues.length > 0) {
        await tx.validationIssue.createMany({
          data: validationResult.issues.map((iss) => ({
            invoiceId,
            code: iss.code,
            field: iss.field || null,
            severity: iss.severity,
            message: iss.message,
          })),
        });
      }

      // Update invoice record
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          processingStatus: 'COMPLETED',
          classificationStatus,
          validationStatus: validationResult.status,
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
 * Re-validates an existing invoice with the rule engine.
 */
export async function revalidateInvoice(invoiceId, user) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  const result = await validateInvoiceData(
    {
      vendorName: invoice.vendorName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discountAmount: invoice.discountAmount,
      additionalCharges: invoice.additionalCharges,
      totalAmount: invoice.totalAmount,
      lineItems: invoice.lineItems,
    },
    invoice.organizationId,
    invoice.id
  );

  await prisma.$transaction(async (tx) => {
    await tx.validationIssue.deleteMany({ where: { invoiceId } });

    if (result.issues.length > 0) {
      await tx.validationIssue.createMany({
        data: result.issues.map((iss) => ({
          invoiceId,
          code: iss.code,
          field: iss.field || null,
          severity: iss.severity,
          message: iss.message,
        })),
      });
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        validationStatus: result.status,
      },
    });
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user.id,
    entityType: 'INVOICE',
    entityId: invoice.id,
    action: 'REVALIDATED',
    metadata: { newStatus: result.status, issuesCount: result.issues.length },
  });

  return { validationStatus: result.status, issues: result.issues };
}

/**
 * Applies manual corrections and updates validation status accordingly.
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

  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal ? new Decimal(body.subtotal) : null;
  if (body.taxAmount !== undefined) updateData.taxAmount = body.taxAmount ? new Decimal(body.taxAmount) : null;
  if (body.discountAmount !== undefined) updateData.discountAmount = body.discountAmount ? new Decimal(body.discountAmount) : null;
  if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount ? new Decimal(body.totalAmount) : null;

  updateData.correctedData = {
    ...(invoice.correctedData || {}),
    lastUpdated: new Date().toISOString(),
    updatedBy: user.id,
    fields: body,
  };

  // Check arithmetic verification
  const sub = updateData.subtotal !== undefined ? updateData.subtotal : invoice.subtotal || new Decimal(0);
  const tax = updateData.taxAmount !== undefined ? updateData.taxAmount : invoice.taxAmount || new Decimal(0);
  const disc = updateData.discountAmount !== undefined ? updateData.discountAmount : invoice.discountAmount || new Decimal(0);
  const tot = updateData.totalAmount !== undefined ? updateData.totalAmount : invoice.totalAmount || new Decimal(0);

  const calculatedTotal = new Decimal(sub || 0).plus(tax || 0).minus(disc || 0);
  const difference = calculatedTotal.minus(tot || 0).abs();
  const isArithmeticValid = difference.lessThan(0.02);

  const finalInvNum = updateData.invoiceNumber !== undefined ? updateData.invoiceNumber : invoice.invoiceNumber;
  const finalVendor = updateData.vendorName !== undefined ? updateData.vendorName : invoice.vendorName;

  if (isArithmeticValid && finalInvNum && finalVendor) {
    updateData.validationStatus = 'VALIDATED';
    await prisma.validationIssue.deleteMany({
      where: { invoiceId, code: 'ARITHMETIC_MISMATCH' },
    });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
    include: {
      lineItems: true,
      validationIssues: true,
    },
  });

  await createAuditLog({
    organizationId: invoice.organizationId,
    actorId: user.id,
    entityType: 'INVOICE',
    entityId: invoice.id,
    action: 'CORRECTED',
    metadata: { fields: Object.keys(body) },
  });

  return updated;
}
