// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/invoices/[id]/revalidate
// Re-evaluates all business and arithmetic validation rules
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateInvoiceData } from '@/services/invoiceValidation';
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
      include: { lineItems: true },
    });

    if (!invoice) {
      return apiError('Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    // Run validation rules engine
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

    // Update status and replace validation issues in a transaction
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

    return apiResponse({
      success: true,
      validationStatus: result.status,
      issues: result.issues,
    });
  } catch (error) {
    console.error('Error revalidating invoice:', error);
    return apiError(error.message || 'Failed to revalidate invoice.', 500);
  }
}
