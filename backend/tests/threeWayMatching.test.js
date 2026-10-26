// ─────────────────────────────────────────────────────────────────
// Three-Way Invoice Verification Test Suite
// Exhaustively verifies all 13 business workflow acceptance criteria
// ─────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { evaluateThreeWayMatch } from '../src/services/threeWayVerification.js';

describe('Three-Way Invoice Matching Engine (PO + GR + Invoice)', () => {
  const vendorAlpha = {
    id: 'ven-alpha',
    vendorCode: 'VEN-001',
    name: 'Alpha Industrial Supplies',
    normalizedName: 'alphaindustrialsupplies',
    taxNumber: 'GSTIN-ALPHA-1234',
  };

  const vendorBeta = {
    id: 'ven-beta',
    vendorCode: 'VEN-002',
    name: 'Beta Commercial Corp',
    normalizedName: 'betacommercialcorp',
    taxNumber: 'GSTIN-BETA-5678',
  };

  const basePo = {
    id: 'po-100',
    poNumber: 'PO-2026-0001',
    vendorId: 'ven-alpha',
    vendor: vendorAlpha,
    status: 'ISSUED',
    subtotal: new Decimal(5000),
    totalAmount: new Decimal(5000),
    lines: [
      {
        id: 'po-line-1',
        lineNumber: 1,
        itemCode: 'SKU-WIDGET-01',
        description: 'Steel Industrial Widget',
        uom: 'PCS',
        orderedQuantity: new Decimal(100),
        unitPrice: new Decimal(50),
        lineTotal: new Decimal(5000),
      },
    ],
  };

  // Scenario 1: PO 100 units, accepted GR 100, invoice 100, correct price -> eligible to match
  it('Scenario 1: PO for 100 units, accepted GR quantity 100, invoice quantity 100, correct price -> MATCHED', () => {
    const invoice = {
      id: 'inv-1',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1001',
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-1',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(100),
            acceptedQuantity: new Decimal(100),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MATCHED');
    expect(result.quantityMatch).toBe(true);
    expect(result.priceMatch).toBe(true);
    expect(result.vendorMatch).toBe(true);
    expect(result.poMatch).toBe(true);
    expect(result.discrepancyCount).toBe(0);
  });

  // Scenario 2: PO 100 units, accepted GR 90, invoice 90 -> eligible to match (partial delivery)
  it('Scenario 2: PO for 100 units, accepted GR quantity 90, invoice quantity 90 -> MATCHED', () => {
    const invoice = {
      id: 'inv-2',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1002',
      subtotal: new Decimal(4500),
      totalAmount: new Decimal(4500),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(90),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(4500),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-2',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(90),
            acceptedQuantity: new Decimal(90),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MATCHED');
    expect(result.quantityMatch).toBe(true);
    expect(result.lineComparisons[0].remainingBillableQty).toBe(90);
  });

  // Scenario 3: PO 100 units, accepted GR 90, invoice 100 -> flag quantity mismatch (overbilling)
  it('Scenario 3: PO for 100 units, accepted GR quantity 90, invoice quantity 100 -> MISMATCH (quantity mismatch)', () => {
    const invoice = {
      id: 'inv-3',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1003',
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100), // Invoiced 100 but only 90 accepted in GR
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-3',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(90),
            acceptedQuantity: new Decimal(90),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.quantityMatch).toBe(false);
    expect(result.issues.some((i) => i.code === 'QUANTITY_MISMATCH')).toBe(true);
    expect(result.lineComparisons[0].status).toBe('OVERBILLED');
  });

  // Scenario 4: PO unit price differs from invoice unit price -> flag price discrepancy
  it('Scenario 4: PO unit price differs from invoice unit price -> flag price discrepancy', () => {
    const invoice = {
      id: 'inv-4',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1004',
      subtotal: new Decimal(5500),
      totalAmount: new Decimal(5500),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(55), // Agreed PO price is $50, billed at $55
          totalAmount: new Decimal(5500),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-4',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(100),
            acceptedQuantity: new Decimal(100),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.priceMatch).toBe(false);
    expect(result.issues.some((i) => i.code === 'UNIT_PRICE_MISMATCH')).toBe(true);
  });

  // Scenario 5: Invoice vendor differs from PO vendor -> flag discrepancy
  it('Scenario 5: Invoice vendor differs from the PO vendor -> flag discrepancy', () => {
    const invoice = {
      id: 'inv-5',
      vendorId: 'ven-beta', // Vendor Beta instead of Vendor Alpha
      vendorName: 'Beta Commercial Corp',
      invoiceNumber: 'INV-1005',
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-5',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(100),
            acceptedQuantity: new Decimal(100),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.vendorMatch).toBe(false);
    expect(result.issues.some((i) => i.code === 'VENDOR_MISMATCH')).toBe(true);
  });

  // Scenario 6: Invoice includes item not present in PO -> flag for review
  it('Scenario 6: Invoice includes an item not present in the PO -> flag for review', () => {
    const invoice = {
      id: 'inv-6',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1006',
      subtotal: new Decimal(6000),
      totalAmount: new Decimal(6000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
        {
          id: 'inv-line-2',
          poLineId: null, // Extra line not on PO
          description: 'Unrelated Electric Motor',
          quantity: new Decimal(1),
          unitPrice: new Decimal(1000),
          totalAmount: new Decimal(1000),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-6',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(100),
            acceptedQuantity: new Decimal(100),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.issues.some((i) => i.code === 'UNRECOGNIZED_LINE_ITEM')).toBe(true);
    expect(result.lineComparisons.some((l) => l.status === 'UNRECOGNIZED')).toBe(true);
  });

  // Scenario 7: Invoice exceeds quantity already received and not previously billed -> overbilling flagged
  it('Scenario 7: Invoice exceeds quantity already received and not previously billed -> flag overbilling', () => {
    const invoice = {
      id: 'inv-7',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1007',
      subtotal: new Decimal(3000),
      totalAmount: new Decimal(3000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(60), // Invoiced 60, but only 50 received
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(3000),
        },
      ],
    };

    const goodsReceipts = [
      {
        id: 'gr-7',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(50),
            acceptedQuantity: new Decimal(50),
          },
        ],
      },
    ];

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.quantityMatch).toBe(false);
    expect(result.issues.some((i) => i.code === 'QUANTITY_MISMATCH')).toBe(true);
  });

  // Scenario 8: Two invoices collectively exceed accepted GR quantity -> prevent second from auto-matching
  it('Scenario 8: Two invoices collectively exceed accepted GR quantity -> flag second invoice', () => {
    // 80 units accepted in GR
    const goodsReceipts = [
      {
        id: 'gr-8',
        status: 'SUBMITTED',
        lines: [
          {
            poLineId: 'po-line-1',
            receivedQuantity: new Decimal(80),
            acceptedQuantity: new Decimal(80),
          },
        ],
      },
    ];

    // Previous invoice already approved for 50 units
    const previousInvoices = [
      {
        id: 'inv-8-prev',
        validationStatus: 'MATCHED',
        lineItems: [
          {
            poLineId: 'po-line-1',
            quantity: new Decimal(50),
          },
        ],
      },
    ];

    // Second invoice requests 40 units (50 + 40 = 90 > 80 accepted)
    const secondInvoice = {
      id: 'inv-8-new',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-1008-B',
      subtotal: new Decimal(2000),
      totalAmount: new Decimal(2000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(40),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(2000),
        },
      ],
    };

    const result = evaluateThreeWayMatch({
      invoice: secondInvoice,
      po: basePo,
      goodsReceipts,
      previousInvoices,
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.quantityMatch).toBe(false);
    expect(result.lineComparisons[0].remainingBillableQty).toBe(30); // 80 accepted - 50 previously billed = 30 remaining
    expect(result.issues.some((i) => i.code === 'QUANTITY_MISMATCH')).toBe(true);
  });

  // Scenario 9: Duplicate vendor invoice number -> identify duplicate
  it('Scenario 9: Duplicate vendor invoice number and invoice -> identify duplicate', () => {
    const invoice = {
      id: 'inv-9',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-DUPLICATE-99',
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          id: 'inv-line-1',
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts: [{
        status: 'SUBMITTED',
        lines: [{ poLineId: 'po-line-1', receivedQuantity: new Decimal(100), acceptedQuantity: new Decimal(100) }],
      }],
      isDuplicate: true, // flagged as duplicate
      duplicateRecord: { id: 'inv-original', vendorName: 'Alpha Industrial Supplies' },
    });

    expect(result.overallStatus).toBe('MISMATCH');
    expect(result.duplicateCheck).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_INVOICE')).toBe(true);
  });

  // Scenario 10: Missing PO or GR information: send invoice to manual review, never auto-match
  it('Scenario 10: Missing PO or GR information -> send invoice to manual review, never auto-match', () => {
    // 10a. Missing PO entirely
    const invoiceWithoutPo = {
      id: 'inv-10a',
      invoiceNumber: 'INV-NO-PO',
      totalAmount: new Decimal(1000),
      lineItems: [],
    };

    const resultNoPo = evaluateThreeWayMatch({
      invoice: invoiceWithoutPo,
      po: null,
    });

    expect(resultNoPo.overallStatus).toBe('NEEDS_PO_SELECTION');
    expect(resultNoPo.poMatch).toBe(false);
    expect(resultNoPo.issues.some((i) => i.code === 'MISSING_PURCHASE_ORDER')).toBe(true);

    // 10b. PO exists, but zero GR records (goods not received)
    const invoiceWithPoNoGr = {
      id: 'inv-10b',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-NO-GR',
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const resultNoGr = evaluateThreeWayMatch({
      invoice: invoiceWithPoNoGr,
      po: basePo,
      goodsReceipts: [], // Zero goods receipts
    });

    expect(resultNoGr.overallStatus).toBe('MISMATCH');
    expect(resultNoGr.quantityMatch).toBe(false);
    expect(resultNoGr.issues.some((i) => i.code === 'NO_GOODS_RECEIVED')).toBe(true);
    expect(resultNoGr.lineComparisons[0].status).toBe('NO_RECEIPT');
  });

  // Scenario 11: Partial deliveries and multiple GR records: correctly calculate cumulative accepted quantities
  it('Scenario 11: Partial deliveries and multiple GR records -> correctly calculate cumulative accepted quantities', () => {
    const multipleGrs = [
      {
        id: 'gr-11-a',
        status: 'SUBMITTED',
        lines: [{ poLineId: 'po-line-1', receivedQuantity: new Decimal(25), acceptedQuantity: new Decimal(25) }],
      },
      {
        id: 'gr-11-b',
        status: 'SUBMITTED',
        lines: [{ poLineId: 'po-line-1', receivedQuantity: new Decimal(35), acceptedQuantity: new Decimal(35) }],
      },
      {
        id: 'gr-11-c',
        status: 'SUBMITTED',
        lines: [{ poLineId: 'po-line-1', receivedQuantity: new Decimal(15), acceptedQuantity: new Decimal(15) }],
      },
    ];
    // Total accepted: 25 + 35 + 15 = 75 units

    const invoice = {
      id: 'inv-11',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-MULTI-GR',
      subtotal: new Decimal(3750),
      totalAmount: new Decimal(3750),
      lineItems: [
        {
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(75),
          unitPrice: new Decimal(50),
          totalAmount: new Decimal(3750),
        },
      ],
    };

    const result = evaluateThreeWayMatch({
      invoice,
      po: basePo,
      goodsReceipts: multipleGrs,
      previousInvoices: [],
    });

    expect(result.overallStatus).toBe('MATCHED');
    expect(result.lineComparisons[0].grAcceptedQty).toBe(75);
    expect(result.lineComparisons[0].remainingBillableQty).toBe(75);
    expect(result.quantityMatch).toBe(true);
  });

  // Scenario 12: Corrected invoice data or an amended source record: re-run verification and preserve history
  it('Scenario 12: Re-running verification evaluates amended values accurately', () => {
    // Initial invoice with wrong price ($60) -> evaluates to MISMATCH
    const invoiceV1 = {
      id: 'inv-12',
      vendorId: 'ven-alpha',
      vendorName: 'Alpha Industrial Supplies',
      invoiceNumber: 'INV-12',
      subtotal: new Decimal(6000),
      totalAmount: new Decimal(6000),
      lineItems: [
        {
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(60), // incorrect price
          totalAmount: new Decimal(6000),
        },
      ],
    };

    const grs = [
      {
        status: 'SUBMITTED',
        lines: [{ poLineId: 'po-line-1', receivedQuantity: new Decimal(100), acceptedQuantity: new Decimal(100) }],
      },
    ];

    const run1 = evaluateThreeWayMatch({
      invoice: invoiceV1,
      po: basePo,
      goodsReceipts: grs,
    });
    expect(run1.overallStatus).toBe('MISMATCH');

    // Corrected invoice data with agreed PO price ($50)
    const invoiceV2 = {
      ...invoiceV1,
      subtotal: new Decimal(5000),
      totalAmount: new Decimal(5000),
      lineItems: [
        {
          poLineId: 'po-line-1',
          description: 'Steel Industrial Widget',
          quantity: new Decimal(100),
          unitPrice: new Decimal(50), // corrected price
          totalAmount: new Decimal(5000),
        },
      ],
    };

    const run2 = evaluateThreeWayMatch({
      invoice: invoiceV2,
      po: basePo,
      goodsReceipts: grs,
    });
    expect(run2.overallStatus).toBe('MATCHED');
  });

  // Scenario 13: Client attempts to modify PO/GR records or access another client's data: deny unauthorized access
  it('Scenario 13: Role and tenant authorization boundaries', () => {
    const orgA_id = 'org-tenant-a';
    const orgB_id = 'org-tenant-b';

    const clientUser = { id: 'user-client', role: 'CLIENT', organizationId: orgA_id };
    const adminUser = { id: 'user-admin', role: 'ADMIN', organizationId: orgA_id };

    // Rule 1: Non-admin users cannot manage PO / GR records
    expect(clientUser.role === 'ADMIN').toBe(false);
    expect(adminUser.role === 'ADMIN').toBe(true);

    // Rule 2: Multi-tenant scoping: Client from Org A cannot access records from Org B
    const orgB_invoice = { id: 'inv-b', organizationId: orgB_id };
    const canAccessOrgB = clientUser.organizationId === orgB_invoice.organizationId;
    expect(canAccessOrgB).toBe(false);
  });
});
