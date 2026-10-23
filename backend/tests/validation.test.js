import { describe, it, expect } from 'vitest';
import { validateInvoiceData } from '../src/services/invoiceValidation.js';

describe('Invoice Validation Service', () => {
  it('should flag missing vendor and invoice number as ERROR', async () => {
    const result = await validateInvoiceData({
      vendorName: '',
      invoiceNumber: '',
      invoiceDate: null,
      totalAmount: null,
    }, 'test-org');

    expect(result.status).toBe('NEEDS_REVIEW');
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('MISSING_VENDOR_NAME');
    expect(codes).toContain('MISSING_INVOICE_NUMBER');
    expect(codes).toContain('MISSING_INVOICE_DATE');
    expect(codes).toContain('MISSING_TOTAL_AMOUNT');
  });

  it('should flag arithmetic mismatch when subtotal + tax does not equal total', async () => {
    const result = await validateInvoiceData({
      vendorName: 'Valid Vendor',
      invoiceNumber: 'INV-100',
      invoiceDate: new Date('2026-03-01'),
      subtotal: 100,
      taxAmount: 20,
      discountAmount: 0,
      totalAmount: 150, // Mismatch: 100 + 20 != 150
    }, 'test-org');

    expect(result.status).toBe('NEEDS_REVIEW');
    const mismatchIssue = result.issues.find((i) => i.code === 'ARITHMETIC_MISMATCH');
    expect(mismatchIssue).toBeDefined();
  });

  it('should pass validation when fields and arithmetic are accurate', async () => {
    const result = await validateInvoiceData({
      vendorName: 'Acme Test Corp',
      invoiceNumber: 'INV-TEST-999',
      invoiceDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-31'),
      subtotal: 100,
      taxAmount: 10,
      discountAmount: 5,
      additionalCharges: 0,
      totalAmount: 105, // 100 + 10 - 5 = 105
      lineItems: [
        { totalAmount: 100 },
      ],
    }, 'test-org');

    const errorIssues = result.issues.filter((i) => i.severity === 'ERROR');
    expect(errorIssues.length).toBe(0);
    expect(result.status).toBe('VALIDATED');
  });
});
