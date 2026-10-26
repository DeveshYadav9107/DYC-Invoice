// ─────────────────────────────────────────────────────────────────
// CSV Export Service — Secure invoice export with formula protection
// ─────────────────────────────────────────────────────────────────

import { stringify } from 'csv-stringify/sync';

/**
 * Escapes strings to protect against CSV / Excel Formula Injection (DDE attacks).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote.
 */
export function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Generates CSV string for verified/matched invoices.
 */
export function generateInvoicesCsv(invoices) {
  const headers = [
    'Invoice ID',
    'Original File Name',
    'Vendor Name',
    'Vendor Tax ID',
    'PO Number',
    'Invoice Number',
    'Invoice Date',
    'Due Date',
    'Currency',
    'Subtotal',
    'Tax Amount',
    'Discount Amount',
    'Total Amount',
    'Line Items Count',
    'Verification Status',
    'Export Timestamp',
  ];

  const nowIso = new Date().toISOString();

  const rows = invoices.map((inv) => {
    return [
      sanitizeCsvValue(inv.id),
      sanitizeCsvValue(inv.originalFileName),
      sanitizeCsvValue(inv.vendor?.name || inv.vendorName),
      sanitizeCsvValue(inv.vendor?.taxNumber || inv.vendorTaxNumber),
      sanitizeCsvValue(inv.purchaseOrder?.poNumber || inv.purchaseOrderNumber),
      sanitizeCsvValue(inv.invoiceNumber),
      inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
      inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      sanitizeCsvValue(inv.currency || 'USD'),
      inv.subtotal ? Number(inv.subtotal).toFixed(2) : '0.00',
      inv.taxAmount ? Number(inv.taxAmount).toFixed(2) : '0.00',
      inv.discountAmount ? Number(inv.discountAmount).toFixed(2) : '0.00',
      inv.totalAmount ? Number(inv.totalAmount).toFixed(2) : '0.00',
      inv._count?.lineItems || inv.lineItems?.length || 0,
      inv.validationStatus,
      nowIso,
    ];
  });

  return stringify([headers, ...rows], {
    quoted: true,
    bom: true, // UTF-8 Byte Order Mark for Excel compatibility
  });
}
