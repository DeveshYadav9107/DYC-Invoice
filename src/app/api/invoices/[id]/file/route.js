// ─────────────────────────────────────────────────────────────────
// API Route: GET /api/invoices/[id]/file
// Streams authenticated invoice document (PDF or image)
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
    const invoiceId = resolvedParams.id;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return apiError('Invoice not found.', 404);
    }

    // Enforce multi-tenant organization isolation (or admin access)
    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    const fileData = await getInvoiceFileBuffer(invoice.storageKey);

    return new Response(fileData.buffer, {
      status: 200,
      headers: {
        'Content-Type': invoice.mimeType || fileData.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(invoice.originalFileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error streaming invoice file:', error);
    return apiError(error.message || 'Failed to retrieve invoice file.', 500);
  }
}
