// ─────────────────────────────────────────────────────────────────
// Invoice Controller — CRUD, Upload, Review, Revalidation & Streaming
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { uploadInvoiceFile, getInvoiceFileBuffer, deleteInvoiceFile } from '../services/azureBlobStorage.js';
import { processUploadedInvoice, revalidateInvoice, updateInvoiceCorrections } from '../services/invoiceService.js';
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

    // Tenant isolation: clients restricted to their organization, admins can view all or filtered
    const where = {};
    if (!isAdmin && user.organizationId) {
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
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { validationIssues: true, lineItems: true },
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
        processingStatus: 'UPLOADED',
        classificationStatus: 'PENDING',
        validationStatus: 'PENDING',
      },
    });

    // 3. Process extraction & validation
    try {
      await processUploadedInvoice(invoice.id, file.buffer);
    } catch (err) {
      console.error(`Failed to process invoice ${invoice.id}:`, err);
    }

    // 4. Retrieve updated invoice
    const processedInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      select: {
        id: true,
        originalFileName: true,
        fileSize: true,
        processingStatus: true,
        validationStatus: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice uploaded and processed successfully.',
      invoice: processedInvoice || {
        id: invoice.id,
        fileName: invoice.originalFileName,
        fileSize: invoice.fileSize,
        status: invoice.processingStatus,
      },
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
        lineItems: true,
        validationIssues: true,
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

    return successResponse(res, { invoice: updated }, 'Invoice updated successfully.');
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

    return successResponse(res, {}, 'Invoice re-processed successfully.');
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
    }, 'Invoice revalidated successfully.');
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
      include: { lineItems: true },
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (invoice.validationStatus !== 'VALIDATED') {
      return errorResponse(res, 'Only validated invoices can be exported to CSV.', 400);
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
