import { describe, it, expect } from 'vitest';
import { generateInvoicesCsv } from '../src/services/csvExport.js';

describe('CSV Export Service', () => {
  it('should generate valid CSV with headers and values', () => {
    const mockInvoices = [
      {
        id: 'inv_123',
        originalFileName: 'test.pdf',
        vendorName: 'Acme Corp',
        vendorTaxNumber: 'TAX123',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2026-01-15'),
        dueDate: new Date('2026-02-15'),
        currency: 'USD',
        subtotal: 100.0,
        taxAmount: 10.0,
        discountAmount: 0.0,
        totalAmount: 110.0,
        validationStatus: 'VALIDATED',
        lineItems: [{ id: '1' }],
      },
    ];

    const csv = generateInvoicesCsv(mockInvoices);
    expect(csv).toContain('Invoice ID');
    expect(csv).toContain('Acme Corp');
    expect(csv).toContain('INV-001');
    expect(csv).toContain('110.00');
  });

  it('should sanitize formula injection attempts starting with =, +, -, @', () => {
    const malicious = [
      {
        id: '=cmd|',
        originalFileName: '+calc.pdf',
        vendorName: '@SUM(A1:A10)',
        vendorTaxNumber: '-danger',
        invoiceNumber: '=1+1',
        invoiceDate: null,
        dueDate: null,
        currency: 'USD',
        subtotal: 10,
        taxAmount: 1,
        discountAmount: 0,
        totalAmount: 11,
        validationStatus: 'VALIDATED',
      },
    ];

    const csv = generateInvoicesCsv(malicious);
    expect(csv).toContain('"\'=cmd|"');
    expect(csv).toContain('"\'\+calc.pdf"');
    expect(csv).toContain('"\'@SUM(A1:A10)"');
  });
});
