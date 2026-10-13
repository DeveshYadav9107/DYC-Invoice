// ─────────────────────────────────────────────────────────────────
// API Route: /api/exports
// GET: List export batches for organization
// POST: Generate new CSV export batch for validated invoices
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateInvoicesCsv } from '@/services/csvExport';
import { uploadInvoiceFile } from '@/services/storage';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;

    const batches = await prisma.exportBatch.findMany({
      where: { organizationId: user.organizationId || undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return apiResponse({ batches });
  } catch (error) {
    console.error('Error fetching export batches:', error);
    return apiError(error.message || 'Failed to fetch export history.', 500);
  }
}

export async function POST(request) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    if (!user.organizationId) {
      return apiError('Organization membership required.', 403);
    }

    const body = await request.json().catch(() => ({}));
    const requestedIds = body.invoiceIds; // Array of specific IDs or null for all validated

    const where = {
      organizationId: user.organizationId,
      validationStatus: 'VALIDATED', // STRICT REQUIREMENT: Only validated invoices can be exported
    };

    if (Array.isArray(requestedIds) && requestedIds.length > 0) {
      where.id = { in: requestedIds };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lineItems: true,
      },
      orderBy: { invoiceDate: 'desc' },
    });

    if (invoices.length === 0) {
      return apiError(
        'No eligible validated invoices found to export. Invoices must have passed all validation checks.',
        400
      );
    }

    // Generate CSV content
    const csvContent = generateInvoicesCsv(invoices);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    // Save CSV to blob storage
    const fileName = `export-${Date.now()}.csv`;
    const uploadResult = await uploadInvoiceFile(
      csvBuffer,
      fileName,
      'text/csv',
      user.organizationId
    );

    // Record export batch in database
    const batch = await prisma.exportBatch.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        status: 'COMPLETED',
        rowCount: invoices.length,
        invoiceIds: invoices.map((inv) => inv.id),
        storageKey: uploadResult.storageKey,
      },
    });

    return apiResponse({
      success: true,
      message: `Export batch created with ${invoices.length} validated invoices.`,
      batch: {
        id: batch.id,
        rowCount: batch.rowCount,
        createdAt: batch.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating export batch:', error);
    return apiError(error.message || 'Failed to generate export batch.', 500);
  }
}
