// ─────────────────────────────────────────────────────────────────
// Invoice Processing Pipeline — Orchestrator
// Connects Azure AI Document Intelligence with Business Validation
// ─────────────────────────────────────────────────────────────────

import prisma from '@/lib/prisma';
import Decimal from 'decimal.js';
import { getInvoiceFileBuffer } from '@/services/storage';
import { analyzeInvoiceDocument } from '@/services/extraction/azureDocumentIntelligence';
import { validateInvoiceData, normalizeKey } from '@/services/invoiceValidation';

/**
 * Executes the complete invoice processing lifecycle for an uploaded document.
 * @param {string} invoiceId - Database ID of the uploaded Invoice
 */
export async function processUploadedInvoice(invoiceId) {
  try {
    // 1. Mark as PROCESSING
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { processingStatus: 'PROCESSING' },
    });

    // 2. Fetch document buffer from storage
    const { buffer } = await getInvoiceFileBuffer(invoice.storageKey);

    // 3. Azure AI Document Intelligence Extraction
    const { extracted, confidence, raw } = await analyzeInvoiceDocument(buffer);

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
      // Clear previous line items and issues if re-processing
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId } });
      await tx.validationIssue.deleteMany({ where: { invoiceId } });

      // Save line items
      if (extracted.lineItems && extracted.lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: extracted.lineItems.map((item) => ({
            invoiceId,
            description: item.description,
            quantity: item.quantity !== null ? new Decimal(item.quantity) : null,
            unitPrice: item.unitPrice !== null ? new Decimal(item.unitPrice) : null,
            taxAmount: item.taxAmount !== null ? new Decimal(item.taxAmount) : null,
            totalAmount: item.totalAmount !== null ? new Decimal(item.totalAmount) : null,
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
          subtotal: extracted.subtotal !== null ? new Decimal(extracted.subtotal) : null,
          taxAmount: extracted.taxAmount !== null ? new Decimal(extracted.taxAmount) : null,
          totalAmount: extracted.totalAmount !== null ? new Decimal(extracted.totalAmount) : null,
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
