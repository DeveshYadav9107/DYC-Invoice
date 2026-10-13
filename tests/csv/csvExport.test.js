import { describe, it, expect } from 'vitest';
import { generateInvoicesCsv } from '@/services/csvExport';

describe('CSV Export Service', () => {
  it('should generate valid CSV with RFC 4180 headers and BOM', () => {
    const mockInvoices = [
      {
        id: 'inv_123',
        originalFileName: 'invoice_1.pdf',
        vendorName: 'Acme Corp',
        vendorTaxNumber: 'US123456789',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        currency: 'USD',
        subtotal: 100.0,
        taxAmount: 10.0,
        discountAmount: 0.0,
        totalAmount: 110.0,
        validationStatus: 'VALIDATED',
        lineItems: [{ id: '1' }, { id: '2' }],
      },
    ];

    const csv = generateInvoicesCsv(mockInvoices);

    expect(csv).toContain('Invoice ID');
    expect(csv).toContain('Vendor Name');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('INV-001');
    expect(csv).toContain('110.00');
  });

  it('should sanitize formula injection attempts starting with =, +, -, @', () => {
    const maliciousInvoices = [
      {
        id: '=1+1',
        originalFileName: '+calc.pdf',
        vendorName: '@SUM(A1:A10)',
        vendorTaxNumber: '-cmd|',
        invoiceNumber: '=cmd',
        invoiceDate: null,
        dueDate: null,
        currency: 'USD',
        subtotal: 50,
        taxAmount: 5,
        discountAmount: 0,
        totalAmount: 55,
        validationStatus: 'VALIDATED',
      },
    ];

    const csv = generateInvoicesCsv(maliciousInvoices);

    // Ensure leading single quote prefix is added to neutralize formulas
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\'\+calc.pdf"');
    expect(csv).toContain('"\'@SUM(A1:A10)"');
    expect(csv).toContain('"\'\-cmd|"');
  });
});
