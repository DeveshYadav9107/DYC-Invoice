// ─────────────────────────────────────────────────────────────────
// API Route: GET /api/exports/[id]/download
// Streams CSV file for the requested export batch
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getInvoiceFileBuffer } from '@/services/storage';
import { apiError } from '@/lib/utils';

export async function GET(request, { params }) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    const resolvedParams = await params;
    const batchId = resolvedParams.id;

    const batch = await prisma.exportBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return apiError('Export batch not found.', 404);
    }

    if (user.role !== 'ADMIN' && batch.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    if (!batch.storageKey) {
      return apiError('Export file has no associated storage.', 404);
    }

    const fileData = await getInvoiceFileBuffer(batch.storageKey);

    return new Response(fileData.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoiceflow-export-${batch.id.slice(-6)}.csv"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error downloading export batch:', error);
    return apiError(error.message || 'Failed to download export.', 500);
  }
}
