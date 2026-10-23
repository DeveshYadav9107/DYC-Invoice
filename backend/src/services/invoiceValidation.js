// ─────────────────────────────────────────────────────────────────
// Invoice Validation Service — Business Rules & Arithmetic Engine
// ─────────────────────────────────────────────────────────────────

import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { normalizeKey } from '../utils/helpers.js';

export async function validateInvoiceData(invoiceData, organizationId, currentInvoiceId = null) {
  const issues = [];

  const {
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal,
    taxAmount,
    discountAmount,
    additionalCharges,
    totalAmount,
    lineItems = [],
  } = invoiceData;

  // ─── Rule 1: Required Fields Check ─────────────────────────────
  if (!vendorName || !vendorName.trim()) {
    issues.push({
      code: 'MISSING_VENDOR_NAME',
      field: 'vendorName',
      severity: 'ERROR',
      message: 'Vendor name could not be identified on the invoice document.',
    });
  }

  if (!invoiceNumber || !invoiceNumber.trim()) {
    issues.push({
      code: 'MISSING_INVOICE_NUMBER',
      field: 'invoiceNumber',
      severity: 'ERROR',
      message: 'Invoice identifier / number is missing.',
    });
  }

  if (!invoiceDate) {
    issues.push({
      code: 'MISSING_INVOICE_DATE',
      field: 'invoiceDate',
      severity: 'ERROR',
      message: 'Invoice issue date is missing or unparseable.',
    });
  }

  if (totalAmount === null || totalAmount === undefined) {
    issues.push({
      code: 'MISSING_TOTAL_AMOUNT',
      field: 'totalAmount',
      severity: 'ERROR',
      message: 'Invoice total amount is missing.',
    });
  } else if (Number(totalAmount) <= 0) {
    issues.push({
      code: 'INVALID_TOTAL_AMOUNT',
      field: 'totalAmount',
      severity: 'ERROR',
      message: 'Invoice total amount must be greater than zero.',
    });
  }

  // ─── Rule 2: Header Arithmetic Verification ─────────────────────
  if (totalAmount !== null && subtotal !== null) {
    try {
      const sub = new Decimal(subtotal || 0);
      const tax = new Decimal(taxAmount || 0);
      const disc = new Decimal(discountAmount || 0);
      const add = new Decimal(additionalCharges || 0);
      const tot = new Decimal(totalAmount);

      const calculatedTotal = sub.plus(tax).minus(disc).plus(add);
      const diff = calculatedTotal.minus(tot).abs();

      // Allow 2 cents rounding difference
      if (diff.greaterThan(0.02)) {
        issues.push({
          code: 'ARITHMETIC_MISMATCH',
          field: 'totalAmount',
          severity: 'ERROR',
          message: `Total amount mismatch: Subtotal (${sub}) + Tax (${tax}) - Discount (${disc}) = ${calculatedTotal.toFixed(2)}, but document stated ${tot.toFixed(2)} (diff: ${diff.toFixed(2)}).`,
        });
      }
    } catch {
      // Ignore decimal parsing error
    }
  }

  // ─── Rule 3: Line Items Sum vs Subtotal ─────────────────────────
  if (lineItems.length > 0 && subtotal !== null) {
    try {
      let lineItemSum = new Decimal(0);
      let hasValidItems = false;

      for (const item of lineItems) {
        if (item.totalAmount !== null && item.totalAmount !== undefined) {
          lineItemSum = lineItemSum.plus(new Decimal(item.totalAmount));
          hasValidItems = true;
        }
      }

      if (hasValidItems) {
        const sub = new Decimal(subtotal);
        const diff = lineItemSum.minus(sub).abs();

        if (diff.greaterThan(0.05)) {
          issues.push({
            code: 'LINE_ITEMS_SUM_MISMATCH',
            field: 'subtotal',
            severity: 'WARNING',
            message: `Sum of line item totals (${lineItemSum.toFixed(2)}) does not match invoice subtotal (${sub.toFixed(2)}).`,
          });
        }
      }
    } catch {
      // Ignore decimal errors
    }
  }

  // ─── Rule 4: Duplicate Invoice Detection ────────────────────────
  if (vendorName && invoiceNumber && organizationId) {
    const normVendor = normalizeKey(vendorName);
    const normNumber = normalizeKey(invoiceNumber);

    const duplicate = await prisma.invoice.findFirst({
      where: {
        organizationId,
        id: currentInvoiceId ? { not: currentInvoiceId } : undefined,
        normalizedVendorName: normVendor,
        normalizedInvoiceNumber: normNumber,
      },
    });

    if (duplicate) {
      issues.push({
        code: 'DUPLICATE_INVOICE',
        field: 'invoiceNumber',
        severity: 'WARNING',
        message: `Potential duplicate: An invoice from "${vendorName}" with number "${invoiceNumber}" was previously uploaded (${duplicate.originalFileName}).`,
      });
    }
  }

  // ─── Rule 5: Date Sanity Checks ─────────────────────────────────
  if (invoiceDate && dueDate) {
    const invD = new Date(invoiceDate);
    const dueD = new Date(dueDate);
    if (!isNaN(invD.getTime()) && !isNaN(dueD.getTime()) && dueD < invD) {
      issues.push({
        code: 'DUE_DATE_BEFORE_INVOICE_DATE',
        field: 'dueDate',
        severity: 'WARNING',
        message: 'Due date is earlier than the invoice issue date.',
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'ERROR');
  const hasWarnings = issues.some((i) => i.severity === 'WARNING');

  let status = 'VALIDATED';
  if (hasErrors || hasWarnings) {
    status = 'NEEDS_REVIEW';
  }

  return { status, issues };
}
