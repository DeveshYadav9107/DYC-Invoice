// ─────────────────────────────────────────────────────────────────
// Three-Way Invoice Verification Engine (PO + GR + Invoice)
// Authoritative Business Matching & Exception Handling Service
// ─────────────────────────────────────────────────────────────────

import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { normalizeKey } from '../utils/helpers.js';
import { createAuditLog } from './auditLogService.js';

/**
 * Pure evaluation function for Three-Way Matching between Invoice, PO, and GR.
 * Decoupled from database I/O for deterministic testing and instant execution.
 */
export function evaluateThreeWayMatch({
  invoice,
  po = null,
  goodsReceipts = [],
  previousInvoices = [],
  isDuplicate = false,
  duplicateRecord = null,
  options = {},
}) {
  const issues = [];
  const lineComparisons = [];

  // ─── Check 1: Duplicate Check ────────────────────────────────────
  let duplicateCheckPassed = !isDuplicate;
  if (isDuplicate) {
    issues.push({
      code: 'DUPLICATE_INVOICE',
      field: 'invoiceNumber',
      severity: 'ERROR',
      message: `Duplicate Invoice Detected: An invoice with number "${invoice.invoiceNumber}" for vendor "${invoice.vendorName || duplicateRecord?.vendorName || 'Unknown'}" is already registered.`,
    });
  }

  // ─── Check 2: PO Linkage ─────────────────────────────────────────
  if (!po) {
    issues.push({
      code: 'MISSING_PURCHASE_ORDER',
      field: 'purchaseOrderId',
      severity: 'ERROR',
      message: invoice.purchaseOrderNumber
        ? `Purchase Order "${invoice.purchaseOrderNumber}" was referenced on document but does not exist in master data. Please select or create the PO.`
        : 'No Purchase Order is linked to this invoice. PO-based verification requires a valid Purchase Order.',
    });

    return {
      overallStatus: 'NEEDS_PO_SELECTION',
      vendorMatch: false,
      poMatch: false,
      quantityMatch: false,
      priceMatch: false,
      taxMatch: false,
      duplicateCheck: duplicateCheckPassed,
      discrepancyCount: issues.length,
      issues,
      lineComparisons: [],
      summary: {
        reason: 'Missing Purchase Order linkage.',
        poNumber: invoice.purchaseOrderNumber || null,
        vendorName: invoice.vendorName || null,
      },
    };
  }

  // ─── Check 3: PO Status Validity ─────────────────────────────────
  let poMatch = true;
  if (po.status === 'CANCELLED') {
    poMatch = false;
    issues.push({
      code: 'PO_CANCELLED',
      field: 'purchaseOrderId',
      severity: 'ERROR',
      message: `Purchase Order "${po.poNumber}" has been CANCELLED and cannot be invoiced.`,
    });
  } else if (po.status === 'CLOSED') {
    poMatch = false;
    issues.push({
      code: 'PO_CLOSED',
      field: 'purchaseOrderId',
      severity: 'ERROR',
      message: `Purchase Order "${po.poNumber}" has been CLOSED and cannot accept further billings.`,
    });
  } else if (po.status === 'DRAFT') {
    poMatch = false;
    issues.push({
      code: 'PO_NOT_ISSUED',
      field: 'purchaseOrderId',
      severity: 'ERROR',
      message: `Purchase Order "${po.poNumber}" is still in DRAFT status. Only ISSUED POs can be invoiced.`,
    });
  }

  // ─── Check 4: Vendor Matching ─────────────────────────────────────
  let vendorMatch = true;
  const poVendor = po.vendor;

  if (poVendor) {
    const invVendorNorm = invoice.normalizedVendorName || normalizeKey(invoice.vendorName || '');
    const poVendorNorm = poVendor.normalizedName || normalizeKey(poVendor.name || '');

    const idMatch = invoice.vendorId && po.vendorId && invoice.vendorId === po.vendorId;
    const taxMatch = invoice.vendorTaxNumber && poVendor.taxNumber &&
      normalizeKey(invoice.vendorTaxNumber) === normalizeKey(poVendor.taxNumber);
    const nameMatch = invVendorNorm && (invVendorNorm === poVendorNorm || invVendorNorm.includes(poVendorNorm) || poVendorNorm.includes(invVendorNorm));

    if (!idMatch && !taxMatch && !nameMatch) {
      vendorMatch = false;
      issues.push({
        code: 'VENDOR_MISMATCH',
        field: 'vendorName',
        severity: 'ERROR',
        message: `Vendor Discrepancy: Invoice indicates vendor "${invoice.vendorName || 'Unknown'}", but Purchase Order "${po.poNumber}" belongs to "${poVendor.name}".`,
      });
    }
  }

  // ─── Calculate Cumulative Accepted Receipts ───────────────────────
  const acceptedGrByPoLine = new Map();
  const activeGrs = (goodsReceipts || []).filter((gr) => gr.status === 'SUBMITTED');

  for (const gr of activeGrs) {
    for (const grLine of gr.lines || []) {
      const curAcc = acceptedGrByPoLine.get(grLine.poLineId) || new Decimal(0);
      acceptedGrByPoLine.set(grLine.poLineId, curAcc.plus(new Decimal(grLine.acceptedQuantity || 0)));
    }
  }

  // ─── Calculate Cumulative Previously Invoiced Quantities ──────────
  const previouslyInvoicedByPoLine = new Map();
  for (const prevInv of previousInvoices || []) {
    for (const prevItem of prevInv.lineItems || []) {
      if (prevItem.poLineId && prevItem.quantity) {
        const cur = previouslyInvoicedByPoLine.get(prevItem.poLineId) || new Decimal(0);
        previouslyInvoicedByPoLine.set(prevItem.poLineId, cur.plus(new Decimal(prevItem.quantity)));
      }
    }
  }

  // ─── Check 5: Line Items Matching ─────────────────────────────────
  let quantityMatch = true;
  let priceMatch = true;
  const priceTolerance = options.priceTolerance !== undefined ? new Decimal(options.priceTolerance) : new Decimal(0);

  const invoiceLines = invoice.lineItems || [];
  const poLines = po.lines || [];

  if (invoiceLines.length === 0) {
    issues.push({
      code: 'NO_LINE_ITEMS',
      field: 'lineItems',
      severity: 'ERROR',
      message: 'No line items could be extracted from this invoice document for verification.',
    });
  }

  for (const invLine of invoiceLines) {
    let matchedPoLine = null;

    if (invLine.poLineId) {
      matchedPoLine = poLines.find((pl) => pl.id === invLine.poLineId);
    }

    if (!matchedPoLine && invLine.itemCode) {
      matchedPoLine = poLines.find((pl) =>
        pl.itemCode && normalizeKey(pl.itemCode) === normalizeKey(invLine.itemCode)
      );
    }

    if (!matchedPoLine && invLine.description) {
      const normDesc = normalizeKey(invLine.description);
      matchedPoLine = poLines.find((pl) => {
        const poDesc = normalizeKey(pl.description);
        return poDesc === normDesc || poDesc.includes(normDesc) || normDesc.includes(poDesc);
      });
    }

    if (!matchedPoLine && poLines.length === 1 && invoiceLines.length === 1) {
      matchedPoLine = poLines[0];
    }

    if (!matchedPoLine) {
      quantityMatch = false;
      issues.push({
        code: 'UNRECOGNIZED_LINE_ITEM',
        field: `lineItem_${invLine.id || invLine.description}`,
        severity: 'ERROR',
        message: `Unrecognized Item: Invoice line "${invLine.description || 'Unknown'}" does not correspond to any item on Purchase Order "${po.poNumber}". Manual mapping required.`,
      });

      lineComparisons.push({
        invoiceLineId: invLine.id || null,
        description: invLine.description,
        invoiceQty: invLine.quantity ? Number(invLine.quantity) : 0,
        invoiceUnitPrice: invLine.unitPrice ? Number(invLine.unitPrice) : 0,
        invoiceTotal: invLine.totalAmount ? Number(invLine.totalAmount) : 0,
        poLineId: null,
        poOrderedQty: 0,
        grAcceptedQty: 0,
        previouslyInvoicedQty: 0,
        remainingBillableQty: 0,
        poUnitPrice: 0,
        priceDifference: 0,
        status: 'UNRECOGNIZED',
        reason: 'Item not found on Purchase Order.',
      });
      continue;
    }

    const poOrderedQty = new Decimal(matchedPoLine.orderedQuantity || 0);
    const grAcceptedQty = acceptedGrByPoLine.get(matchedPoLine.id) || new Decimal(0);
    const prevInvoicedQty = previouslyInvoicedByPoLine.get(matchedPoLine.id) || new Decimal(0);
    const remainingBillableQty = Decimal.max(0, grAcceptedQty.minus(prevInvoicedQty));

    const invQty = new Decimal(invLine.quantity || 0);
    const poPrice = new Decimal(matchedPoLine.unitPrice || 0);
    const invPrice = new Decimal(invLine.unitPrice || 0);
    const priceDiff = invPrice.minus(poPrice);

    let lineStatus = 'MATCHED';
    const lineReasons = [];

    // GR & Quantity Check
    if (grAcceptedQty.isZero()) {
      quantityMatch = false;
      lineStatus = 'NO_RECEIPT';
      const msg = `Item "${matchedPoLine.description}": No accepted Goods Receipt (GR) found against PO "${po.poNumber}". Invoiced: ${invQty}, Accepted GR: 0.`;
      lineReasons.push(msg);
      issues.push({
        code: 'NO_GOODS_RECEIVED',
        field: `lineItem_${invLine.id || invLine.description}`,
        severity: 'ERROR',
        message: msg,
      });
    } else if (invQty.greaterThan(remainingBillableQty)) {
      quantityMatch = false;
      lineStatus = 'OVERBILLED';
      const msg = `Item "${matchedPoLine.description}": Invoiced quantity (${invQty}) exceeds remaining accepted quantity (${remainingBillableQty.toFixed(2)}). PO Ordered: ${poOrderedQty}, GR Accepted: ${grAcceptedQty}, Previously Invoiced: ${prevInvoicedQty}.`;
      lineReasons.push(msg);
      issues.push({
        code: 'QUANTITY_MISMATCH',
        field: `lineItem_${invLine.id || invLine.description}`,
        severity: 'ERROR',
        message: msg,
      });
    }

    // Price Matching Check
    if (priceDiff.abs().greaterThan(priceTolerance)) {
      priceMatch = false;
      if (lineStatus === 'MATCHED') lineStatus = 'PRICE_MISMATCH';
      const msg = `Item "${matchedPoLine.description}": Unit price discrepancy. Document billed at ${invPrice.toFixed(2)}, agreed PO price is ${poPrice.toFixed(2)} (Diff: ${priceDiff.toFixed(2)}).`;
      lineReasons.push(msg);
      issues.push({
        code: 'UNIT_PRICE_MISMATCH',
        field: `lineItem_${invLine.id || invLine.description}`,
        severity: 'ERROR',
        message: msg,
      });
    }

    lineComparisons.push({
      invoiceLineId: invLine.id || null,
      poLineId: matchedPoLine.id,
      itemCode: matchedPoLine.itemCode || matchedPoLine.item?.itemCode || '—',
      description: matchedPoLine.description,
      uom: matchedPoLine.uom || 'PCS',
      poOrderedQty: poOrderedQty.toNumber(),
      grAcceptedQty: grAcceptedQty.toNumber(),
      previouslyInvoicedQty: prevInvoicedQty.toNumber(),
      remainingBillableQty: remainingBillableQty.toNumber(),
      invoiceQty: invQty.toNumber(),
      poUnitPrice: poPrice.toNumber(),
      invoiceUnitPrice: invPrice.toNumber(),
      priceDifference: priceDiff.toNumber(),
      invoiceTotal: invLine.totalAmount ? Number(invLine.totalAmount) : invQty.mul(invPrice).toNumber(),
      status: lineStatus,
      reason: lineReasons.join('; ') || 'Matched PO line and Goods Receipt.',
    });
  }

  // ─── Check 6: Amount & Arithmetic Validation ─────────────────────
  let taxMatch = true;
  if (invoice.totalAmount !== null && invoice.totalAmount !== undefined && invoice.subtotal !== null && invoice.subtotal !== undefined) {
    try {
      const sub = new Decimal(invoice.subtotal || 0);
      const tax = new Decimal(invoice.taxAmount || 0);
      const disc = new Decimal(invoice.discountAmount || 0);
      const add = new Decimal(invoice.additionalCharges || 0);
      const tot = new Decimal(invoice.totalAmount);

      const calculatedTotal = sub.plus(tax).minus(disc).plus(add);
      const diff = calculatedTotal.minus(tot).abs();

      if (diff.greaterThan(0.05)) {
        taxMatch = false;
        issues.push({
          code: 'ARITHMETIC_MISMATCH',
          field: 'totalAmount',
          severity: 'ERROR',
          message: `Header Arithmetic Discrepancy: Subtotal (${sub}) + Tax (${tax}) - Discount (${disc}) = ${calculatedTotal.toFixed(2)}, but document states ${tot.toFixed(2)} (Difference: ${diff.toFixed(2)}).`,
        });
      }
    } catch {
      // Decimal conversion fallback
    }
  }

  // ─── Determine Overall Status ────────────────────────────────────
  const hasErrors = issues.some((i) => i.severity === 'ERROR');
  const hasWarnings = issues.some((i) => i.severity === 'WARNING');

  let overallStatus = 'MATCHED';
  if (!poMatch || !vendorMatch || !quantityMatch || !priceMatch || !duplicateCheckPassed || !taxMatch) {
    overallStatus = 'MISMATCH';
  } else if (hasErrors || hasWarnings) {
    overallStatus = 'NEEDS_REVIEW';
  }

  return {
    overallStatus,
    vendorMatch,
    poMatch,
    quantityMatch,
    priceMatch,
    taxMatch,
    duplicateCheck: duplicateCheckPassed,
    discrepancyCount: issues.length,
    issues,
    lineComparisons,
    summary: {
      poNumber: po.poNumber,
      poTotal: po.totalAmount ? Number(po.totalAmount) : 0,
      invoiceTotal: invoice.totalAmount ? Number(invoice.totalAmount) : 0,
      grCount: activeGrs.length,
      linesCount: lineComparisons.length,
      matchedLines: lineComparisons.filter((l) => l.status === 'MATCHED').length,
      mismatchedLines: lineComparisons.filter((l) => l.status !== 'MATCHED').length,
    },
  };
}

/**
 * Executes full Three-Way Verification for an invoice against its linked
 * Purchase Order (PO) and associated Goods Receipt (GR) records from the database.
 */
export async function runThreeWayVerification(invoiceId, user = null, options = {}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: {
        include: {
          poLine: true,
          item: true,
        },
      },
      vendor: true,
      purchaseOrder: {
        include: {
          vendor: true,
          lines: {
            include: {
              item: true,
            },
          },
          goodsReceipts: {
            where: { status: 'SUBMITTED' },
            include: {
              lines: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice with ID "${invoiceId}" not found.`);
  }

  const organizationId = invoice.organizationId;

  // Duplicate Check against database
  let isDuplicate = false;
  let duplicateRecord = null;
  if (invoice.invoiceNumber && organizationId) {
    const normNumber = invoice.normalizedInvoiceNumber || normalizeKey(invoice.invoiceNumber);
    const normVendor = invoice.normalizedVendorName || normalizeKey(invoice.vendorName || '');

    const duplicateWhere = {
      organizationId,
      id: { not: invoice.id },
      normalizedInvoiceNumber: normNumber,
    };

    if (invoice.vendorId) {
      duplicateWhere.OR = [
        { vendorId: invoice.vendorId },
        { normalizedVendorName: normVendor },
      ];
    } else if (normVendor) {
      duplicateWhere.normalizedVendorName = normVendor;
    }

    duplicateRecord = await prisma.invoice.findFirst({
      where: duplicateWhere,
    });

    if (duplicateRecord) {
      isDuplicate = true;
    }
  }

  const po = invoice.purchaseOrder;
  let previousInvoices = [];

  if (po) {
    previousInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        purchaseOrderId: po.id,
        id: { not: invoice.id },
        validationStatus: 'MATCHED',
      },
      include: {
        lineItems: true,
      },
    });
  }

  const verificationResult = evaluateThreeWayMatch({
    invoice,
    po,
    goodsReceipts: po?.goodsReceipts || [],
    previousInvoices,
    isDuplicate,
    duplicateRecord,
    options,
  });

  await persistVerificationResults(invoice, verificationResult, user);
  return verificationResult;
}

/**
 * Persists the verification run into the database, updates the invoice status,
 * syncs mapped line item statuses, and writes an audit log entry.
 */
async function persistVerificationResults(invoice, result, user) {
  const invoiceId = invoice.id;
  const organizationId = invoice.organizationId;

  await prisma.$transaction(async (tx) => {
    // 1. Replace existing active validation issues
    await tx.validationIssue.deleteMany({ where: { invoiceId } });

    if (result.issues.length > 0) {
      await tx.validationIssue.createMany({
        data: result.issues.map((iss) => ({
          invoiceId,
          code: iss.code,
          field: iss.field || null,
          severity: iss.severity || 'ERROR',
          message: iss.message,
        })),
      });
    }

    // 2. Update line item mappings and matched statuses
    for (const comp of result.lineComparisons || []) {
      if (comp.invoiceLineId) {
        await tx.invoiceLineItem.update({
          where: { id: comp.invoiceLineId },
          data: {
            poLineId: comp.poLineId || undefined,
            matchedStatus: comp.status,
          },
        }).catch(() => {});
      }
    }

    // 3. Record full verification run for history & audit
    await tx.invoiceVerification.create({
      data: {
        invoiceId,
        purchaseOrderId: invoice.purchaseOrderId || null,
        performedById: user?.id || null,
        overallStatus: result.overallStatus,
        vendorMatch: result.vendorMatch,
        poMatch: result.poMatch,
        quantityMatch: result.quantityMatch,
        priceMatch: result.priceMatch,
        taxMatch: result.taxMatch,
        duplicateCheck: result.duplicateCheck,
        details: {
          lineComparisons: result.lineComparisons,
          summary: result.summary,
          issues: result.issues,
        },
        discrepancyCount: result.discrepancyCount,
      },
    });

    // 4. Update the Invoice record's validationStatus and verificationSummary
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        validationStatus: result.overallStatus,
        verificationSummary: {
          overallStatus: result.overallStatus,
          vendorMatch: result.vendorMatch,
          poMatch: result.poMatch,
          quantityMatch: result.quantityMatch,
          priceMatch: result.priceMatch,
          taxMatch: result.taxMatch,
          discrepancyCount: result.discrepancyCount,
          lastVerifiedAt: new Date().toISOString(),
          verifiedById: user?.id || null,
          summary: result.summary,
        },
      },
    });
  });

  // 5. Create audit log
  await createAuditLog({
    organizationId,
    actorId: user?.id || null,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'VERIFIED_THREE_WAY',
    metadata: {
      status: result.overallStatus,
      discrepancies: result.discrepancyCount,
      poId: invoice.purchaseOrderId,
    },
  }).catch((err) => console.warn('Audit log write error:', err));
}
