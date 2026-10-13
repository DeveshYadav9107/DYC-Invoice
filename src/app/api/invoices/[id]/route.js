// ─────────────────────────────────────────────────────────────────
// API Route: /api/invoices/[id]
// GET: Invoice details with line items and validation issues
// PATCH: Manual corrections to extracted data & re-trigger validation
// DELETE: Delete invoice and underlying storage blob
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deleteInvoiceFile } from '@/services/storage';
import { apiResponse, apiError } from '@/lib/utils';
import Decimal from 'decimal.js';

// ─── GET: Fetch Single Invoice ────────────────────────────────────
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
        validationIssues: true,
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invoice) {
      return apiError('Invoice not found.', 404);
    }

    if (user.role !== 'ADMIN' && invoice.organizationId !== user.organizationId) {
      return apiError('Access denied.', 403);
    }

    return apiResponse({ invoice });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    return apiError(error.message || 'Failed to fetch invoice details.', 500);
  }
}

// ─── PATCH: Update Invoice / Apply Corrections ────────────────────
export async function PATCH(request, { params }) {
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

    const body = await request.json().catch(() => ({}));

    // Update fields
    const updateData = {};
    if (body.vendorName !== undefined) updateData.vendorName = body.vendorName?.trim() || null;
    if (body.invoiceNumber !== undefined) updateData.invoiceNumber = body.invoiceNumber?.trim() || null;
    if (body.invoiceDate !== undefined) updateData.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.currency !== undefined) updateData.currency = body.currency?.trim() || 'USD';

    // Numbers with Decimal.js
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal ? new Decimal(body.subtotal) : null;
    if (body.taxAmount !== undefined) updateData.taxAmount = body.taxAmount ? new Decimal(body.taxAmount) : null;
    if (body.discountAmount !== undefined) updateData.discountAmount = body.discountAmount ? new Decimal(body.discountAmount) : null;
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount ? new Decimal(body.totalAmount) : null;

    // Track corrections JSON history
    updateData.correctedData = {
      ...(invoice.correctedData || {}),
      lastUpdated: new Date().toISOString(),
      updatedBy: user.id,
      fields: body,
    };

    // Re-check basic validation arithmetic
    const sub = updateData.subtotal || invoice.subtotal || new Decimal(0);
    const tax = updateData.taxAmount || invoice.taxAmount || new Decimal(0);
    const disc = updateData.discountAmount || invoice.discountAmount || new Decimal(0);
    const tot = updateData.totalAmount || invoice.totalAmount || new Decimal(0);

    const calculatedTotal = new Decimal(sub).plus(tax).minus(disc);
    const difference = calculatedTotal.minus(tot).abs();

    const isArithmeticValid = difference.lessThan(0.02);

    if (isArithmeticValid && updateData.invoiceNumber && updateData.vendorName) {
      updateData.validationStatus = 'VALIDATED';
      // Clear resolved arithmetic issues
      await prisma.validationIssue.deleteMany({
        where: { invoiceId, code: 'ARITHMETIC_MISMATCH' },
      });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        lineItems: true,
        validationIssues: true,
      },
    });

    return apiResponse({
      success: true,
      message: 'Invoice updated successfully.',
      invoice: updated,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return apiError(error.message || 'Failed to update invoice.', 500);
  }
}

// ─── DELETE: Remove Invoice ───────────────────────────────────────
export async function DELETE(request, { params }) {
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

    // Delete blob from storage
    if (invoice.storageKey) {
      await deleteInvoiceFile(invoice.storageKey).catch(console.error);
    }

    // Delete record from DB (cascades to line items and issues)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    return apiResponse({
      success: true,
      message: 'Invoice deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return apiError(error.message || 'Failed to delete invoice.', 500);
  }
}
