// ─────────────────────────────────────────────────────────────────
// Export Controller — Batch CSV Generation & Downloads
// ─────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma.js';
import { generateInvoicesCsv } from '../services/csvExport.js';
import { uploadInvoiceFile, getInvoiceFileBuffer } from '../services/azureBlobStorage.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * GET /api/exports
 */
export async function getExportBatches(req, res) {
  try {
    const user = req.user;
    const isAdmin = user.role === 'ADMIN';

    const where = isAdmin
      ? {}
      : { organizationId: user.organizationId || undefined };

    const [batches, validatedCount] = await Promise.all([
      prisma.exportBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.invoice.count({
        where: {
          ...where,
          validationStatus: { in: ['VALIDATED', 'MATCHED'] },
        },
      }),
    ]);

    return successResponse(res, { batches, validatedCount });
  } catch (error) {
    console.error('Error fetching export batches:', error);
    return errorResponse(res, error.message || 'Failed to fetch export history.', 500);
  }
}

/**
 * POST /api/exports (Create new batch CSV export)
 */
export async function createExportBatch(req, res) {
  try {
    const user = req.user;
    const isAdmin = user.role === 'ADMIN';
    const body = req.body || {};
    const requestedIds = body.invoiceIds;

    const where = {
      validationStatus: { in: ['VALIDATED', 'MATCHED'] },
    };

    if (Array.isArray(requestedIds) && requestedIds.length > 0) {
      where.id = { in: requestedIds };
      if (!isAdmin && user.organizationId) {
        where.organizationId = user.organizationId;
      }
    } else if (!isAdmin) {
      if (user.organizationId) {
        where.organizationId = user.organizationId;
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { lineItems: true, vendor: true, purchaseOrder: true },
      orderBy: { invoiceDate: 'desc' },
    });

    if (invoices.length === 0) {
      return errorResponse(
        res,
        'No eligible validated invoices found to export. Invoices must have passed all validation checks.',
        400
      );
    }

    const csvContent = generateInvoicesCsv(invoices);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    let targetOrgId = invoices[0]?.organizationId || user.organizationId;
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst();
      targetOrgId = firstOrg?.id;
    }
    if (!targetOrgId) {
      const newOrg = await prisma.organization.create({
        data: { name: 'Default Enterprise', slug: 'default-enterprise' },
      });
      targetOrgId = newOrg.id;
    }

    const fileName = `export-${Date.now()}.csv`;
    const uploadResult = await uploadInvoiceFile(
      csvBuffer,
      fileName,
      'text/csv',
      targetOrgId
    );

    const batch = await prisma.exportBatch.create({
      data: {
        organizationId: targetOrgId,
        createdById: user.id,
        status: 'COMPLETED',
        rowCount: invoices.length,
        invoiceIds: invoices.map((inv) => inv.id),
        storageKey: uploadResult.storageKey,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Export batch created with ${invoices.length} validated invoices.`,
      batch: {
        id: batch.id,
        rowCount: batch.rowCount,
        createdAt: batch.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating export batch:', error);
    return errorResponse(res, error.message || 'Failed to generate export batch.', 500);
  }
}

/**
 * GET /api/exports/:id/download
 */
export async function downloadExportBatch(req, res) {
  try {
    const user = req.user;
    const { id } = req.params;

    const batch = await prisma.exportBatch.findUnique({ where: { id } });

    if (!batch) {
      return errorResponse(res, 'Export batch not found.', 404);
    }

    if (user.role !== 'ADMIN' && batch.organizationId !== user.organizationId) {
      return errorResponse(res, 'Access denied.', 403);
    }

    if (!batch.storageKey) {
      return errorResponse(res, 'Export file has no associated storage.', 404);
    }

    const fileData = await getInvoiceFileBuffer(batch.storageKey);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoiceflow-export-${batch.id.slice(-6)}.csv"`);
    res.setHeader('Cache-Control', 'private, no-cache');

    return res.send(fileData.buffer);
  } catch (error) {
    console.error('Error downloading export batch:', error);
    return errorResponse(res, error.message || 'Failed to download export.', 500);
  }
}
