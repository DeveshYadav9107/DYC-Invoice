// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/invoices/[id]/retry
// Re-triggers full OCR extraction and verification pipeline
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { processUploadedInvoice } from '@/services/invoiceProcessor';
import { createAuditLog } from '@/services/auditLog';
import { apiResponse, apiError } from '@/lib/utils';

export async function POST(request, { params }) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return apiError('Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    // Set status to QUEUED
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        processingStatus: 'QUEUED',
        processingError: null,
      },
    });

    // Run processing asynchronously in background
    processUploadedInvoice(invoiceId).catch((err) => {
      console.error(`Retry processing failed for ${invoiceId}:`, err);
    });

    await createAuditLog({
      organizationId: invoice.organizationId,
      actorId: user.id,
      entityType: 'INVOICE',
      entityId: invoice.id,
      action: 'RETRY_PROCESSING',
    });

    return apiResponse({
      success: true,
      message: 'Invoice re-queued for processing.',
    });
  } catch (error) {
    console.error('Error retrying invoice processing:', error);
    return apiError(error.message || 'Failed to retry invoice processing.', 500);
  }
}
