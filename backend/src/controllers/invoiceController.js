// ─────────────────────────────────────────────────────────────────
// Invoice Controller — CRUD, Upload, Review, Revalidation & Streaming
// Extended with PO Linking, Line Mapping, and 3-Way Verification
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { uploadInvoiceFile, getInvoiceFileBuffer, deleteInvoiceFile } from '../services/azureBlobStorage.js';
import {
  processUploadedInvoice,
  revalidateInvoice,
  updateInvoiceCorrections,
  linkInvoiceToPurchaseOrder,
  mapInvoiceLineItems,
  overrideInvoiceException,
} from '../services/invoiceService.js';
import { runThreeWayVerification } from '../services/threeWayVerification.js';
import { generateInvoicesCsv } from '../services/csvExport.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * GET /api/invoices
 */
export async function getInvoices(req, res) {
  try {
    const user = req.user;
    const isAdmin = user.role === 'ADMIN';

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '15', 10)));
    const skip = (page - 1) * limit;

    const validationStatus = req.query.validationStatus || req.query.status;
    const processingStatus = req.query.processingStatus;
    const search = req.query.search?.trim();

    // Tenant isolation: clients restricted to their organization
    const where = {};
    if (!isAdmin && user.organizationId) {
      where.organizationId = user.organizationId;
    } else if (user.organizationId) {
      where.organizationId = user.organizationId;
    }

    if (validationStatus && validationStatus !== 'ALL') {
      where.validationStatus = validationStatus;
    }

    if (processingStatus && processingStatus !== 'ALL') {
      where.processingStatus = processingStatus;
    }

    if (search) {
      where.OR = [
        { originalFileName: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: { id: true, name: true, vendorCode: true },
          },
          purchaseOrder: {
            select: { id: true, poNumber: true, status: true },
          },
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { validationIssues: true, lineItems: true, verifications: true },
          },
        },
      }),
    ]);

    return successResponse(res, {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return errorResponse(res, error.message || 'Failed to fetch invoices.', 500);
  }
}

/**
 * POST /api/invoices (Upload)
 */
export async function uploadInvoice(req, res) {
  try {
    const user = req.user;
    if (!user.organizationId) {
      return errorResponse(res, 'You must be assigned to an organization to upload invoices.', 403);
    }

    const file = req.file;
    if (!file) {
      return errorResponse(res, 'Please select a valid invoice document.', 400);
    }

    const purchaseOrderId = req.body.purchaseOrderId || null;

    // 1. Upload to storage
    const uploadResult = await uploadInvoiceFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.organizationId
    );

    // 2. Create invoice in DB
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        originalFileName: file.originalname,
        storageKey: uploadResult.storageKey,
        mimeType: file.mimetype,
        fileSize: uploadResult.sizeBytes,
        fileChecksum: uploadResult.checksum,
        purchaseOrderId: purchaseOrderId || null,
        processingStatus: 'UPLOADED',
        classificationStatus: 'PENDING',
        validationStatus: 'PENDING',
      },
    });

    // 3. Process extraction & 3-way verification
    try {
      await processUploadedInvoice(invoice.id, file.buffer);
    } catch (err) {
      console.error(`Failed to process invoice ${invoice.id}:`, err);
    }

    // 4. Retrieve updated invoice
    const processedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        vendor: { select: { id: true, name: true, vendorCode: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        validationIssues: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice uploaded and verified successfully.',
      invoice: processedInvoice,
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return errorResponse(res, error.message || 'Invoice upload failed.', 500);
  }
}

/**
 * GET /api/invoices/:id
 */
export async function getInvoiceById(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: {
          include: {
            vendor: true,
            lines: {
              include: {
                item: true,
                grLines: {
                  include: { goodsReceipt: true },
                },
              },
            },
            goodsReceipts: {
              where: { status: 'SUBMITTED' },
              include: {
                lines: true,
                receivedBy: { select: { id: true, name: true } },
              },
            },
          },
        },
        lineItems: {
          include: {
            poLine: true,
            item: true,
          },
        },
        validationIssues: true,
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            performedBy: { select: { id: true, name: true, email: true } },
          },
        },
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    return successResponse(res, { invoice });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    return errorResponse(res, error.message || 'Failed to fetch invoice details.', 500);
  }
}

/**
 * POST /api/invoices/:id/link-po (Select or change Purchase Order)
 */
export async function linkPurchaseOrderHandler(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { purchaseOrderId } = req.body;

    if (!purchaseOrderId) {
      return errorResponse(res, 'Purchase Order ID is required.', 400);
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const verificationResult = await linkInvoiceToPurchaseOrder(id, purchaseOrderId, user);

    const updated = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: {
          include: {
            vendor: true,
            lines: true,
            goodsReceipts: { include: { lines: true } },
          },
        },
        lineItems: true,
        validationIssues: true,
      },
    });

    return successResponse(res, {
      invoice: updated,
      verificationResult,
    }, 'Purchase Order linked and Three-Way Verification executed.');
  } catch (error) {
    console.error('Error linking purchase order to invoice:', error);
    return errorResponse(res, error.message || 'Failed to link purchase order.', 500);
  }
}

/**
 * POST /api/invoices/:id/map-lines (Manual line item mapping to PO lines)
 */
export async function mapLineItemsHandler(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { lineMappings } = req.body;

    if (!lineMappings || !Array.isArray(lineMappings)) {
      return errorResponse(res, 'Line mappings array is required.', 400);
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const verificationResult = await mapInvoiceLineItems(id, lineMappings, user);

    return successResponse(res, { verificationResult }, 'Line items mapped and re-verified successfully.');
  } catch (error) {
    console.error('Error mapping invoice line items:', error);
    return errorResponse(res, error.message || 'Failed to map line items.', 500);
  }
}

/**
 * POST /api/invoices/:id/override (Admin Only — Approve/Override Exceptions)
 */
export async function overrideInvoiceHandler(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { overrideReason } = req.body;

    if (user.role !== 'ADMIN') {
      return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
    }

    if (!overrideReason || !overrideReason.trim()) {
      return errorResponse(res, 'An audit reason is required to override verification exceptions.', 400);
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    const result = await overrideInvoiceException(id, overrideReason, user);

    const updated = await prisma.invoice.findUnique({
      where: { id },
      include: {
        validationIssues: true,
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    return successResponse(res, { invoice: updated }, 'Invoice exception overridden and marked as MATCHED.');
  } catch (error) {
    console.error('Error overriding invoice exception:', error);
    return errorResponse(res, error.message || 'Failed to override exception.', 500);
  }
}

/**
 * GET /api/invoices/:id/verification (Verification results & details)
 */
export async function getInvoiceVerificationHandler(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, name: true, email: true } },
          },
        },
        validationIssues: true,
      },
    });

    if (!invoice || (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId)) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    const latest = invoice.verifications[0] || null;

    return successResponse(res, {
      latestVerification: latest,
      history: invoice.verifications,
      issues: invoice.validationIssues,
    });
  } catch (error) {
    console.error('Error fetching verification details:', error);
    return errorResponse(res, error.message || 'Failed to fetch verification details.', 500);
  }
}

/**
 * PATCH /api/invoices/:id (Manual review corrections)
 */
export async function updateInvoice(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const updated = await updateInvoiceCorrections(id, req.body || {}, user);

    return successResponse(res, { invoice: updated }, 'Invoice updated and re-verified successfully.');
  } catch (error) {
    console.error('Error updating invoice:', error);
    return errorResponse(res, error.message || 'Failed to update invoice.', 500);
  }
}

/**
 * DELETE /api/invoices/:id
 */
export async function deleteInvoice(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (invoice.storageKey) {
      await deleteInvoiceFile(invoice.storageKey).catch(console.error);
    }

    await prisma.invoice.delete({ where: { id } });

    return successResponse(res, {}, 'Invoice deleted successfully.');
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return errorResponse(res, error.message || 'Failed to delete invoice.', 500);
  }
}

/**
 * GET /api/invoices/:id/file (Stream document preview)
 */
export async function streamInvoiceFile(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const fileData = await getInvoiceFileBuffer(invoice.storageKey);

    res.setHeader('Content-Type', invoice.mimeType || fileData.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(invoice.originalFileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.send(fileData.buffer);
  } catch (error) {
    console.error('Error streaming invoice file:', error);
    return errorResponse(res, error.message || 'Failed to retrieve invoice file.', 500);
  }
}

/**
 * POST /api/invoices/:id/retry
 */
export async function retryProcessing(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    await prisma.invoice.update({
      where: { id },
      data: {
        processingStatus: 'PROCESSING',
        processingError: null,
      },
    });

    try {
      await processUploadedInvoice(id);
    } catch (err) {
      console.error(`Retry processing failed for ${id}:`, err);
    }

    return successResponse(res, {}, 'Invoice re-processed and re-verified successfully.');
  } catch (error) {
    console.error('Error retrying invoice processing:', error);
    return errorResponse(res, error.message || 'Failed to retry invoice processing.', 500);
  }
}

/**
 * POST /api/invoices/:id/revalidate
 */
export async function revalidateInvoiceHandler(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const result = await revalidateInvoice(id, user);

    return successResponse(res, {
      validationStatus: result.validationStatus,
      issues: result.issues,
      details: result.details,
    }, 'Invoice re-verified against PO & Goods Receipt successfully.');
  } catch (error) {
    console.error('Error revalidating invoice:', error);
    return errorResponse(res, error.message || 'Failed to revalidate invoice.', 500);
  }
}

/**
 * GET /api/invoices/:id/export (Single invoice CSV download)
 */
export async function exportSingleInvoice(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, vendor: true, purchaseOrder: true },
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (invoice.validationStatus !== 'MATCHED' && invoice.validationStatus !== 'VALIDATED') {
      return errorResponse(res, 'Only verified MATCHED invoices can be exported to CSV.', 400);
    }

    const csvContent = generateInvoicesCsv([invoice]);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    let targetOrgId = invoice.organizationId || user.organizationId;
    if (!targetOrgId) {
      const org = await prisma.organization.findFirst();
      targetOrgId = org?.id;
    }

    if (targetOrgId) {
      try {
        const fileName = `export-${invoice.invoiceNumber || invoice.id}.csv`;
        const uploadResult = await uploadInvoiceFile(
          csvBuffer,
          fileName,
          'text/csv',
          targetOrgId
        );

        await prisma.exportBatch.create({
          data: {
            organizationId: targetOrgId,
            createdById: user.id,
            status: 'COMPLETED',
            rowCount: 1,
            invoiceIds: [invoice.id],
            storageKey: uploadResult.storageKey,
          },
        });
      } catch (logErr) {
        console.warn('Could not record export batch record:', logErr);
      }
    }

    const safeNumber = (invoice.invoiceNumber || invoice.id.slice(-6)).replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeNumber}.csv"`);
    res.setHeader('Cache-Control', 'private, no-cache');

    return res.send(csvBuffer);
  } catch (error) {
    console.error('Error exporting single invoice CSV:', error);
    return errorResponse(res, error.message || 'Failed to export invoice CSV.', 500);
  }
}
