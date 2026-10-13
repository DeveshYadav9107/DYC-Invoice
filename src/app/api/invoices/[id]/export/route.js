// ─────────────────────────────────────────────────────────────────
// API Route: GET /api/invoices/[id]/export
// Exports a single verified invoice directly as CSV and records batch
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateInvoicesCsv } from '@/services/csvExport';
import { uploadInvoiceFile } from '@/services/storage';
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
      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      return apiError('Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    if (invoice.validationStatus !== 'VALIDATED') {
      return apiError('Only validated invoices can be exported to CSV.', 400);
    }

    // Generate CSV string
    const csvContent = generateInvoicesCsv([invoice]);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    // Create an export batch record
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

    return new Response(csvBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoice-${safeNumber}.csv"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error exporting single invoice CSV:', error);
    return apiError(error.message || 'Failed to export invoice CSV.', 500);
  }
}
