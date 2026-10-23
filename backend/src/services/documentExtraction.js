// ─────────────────────────────────────────────────────────────────
// Azure Document Intelligence — Prebuilt Invoice Model
// Extracts invoice key-value pairs, tables, and line items
// ─────────────────────────────────────────────────────────────────

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

export function isDocIntelligenceConfigured() {
  return Boolean(
    process.env.DOCUMENT_INTELLIGENCE_ENDPOINT?.trim() &&
    process.env.DOCUMENT_INTELLIGENCE_KEY?.trim()
  );
}

function getDocumentClient() {
  const endpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !key) return null;

  try {
    return new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  } catch (err) {
    console.error('Failed to initialize Azure DocumentAnalysisClient:', err);
    return null;
  }
}

export async function analyzeInvoiceDocument(buffer) {
  const client = getDocumentClient();

  if (!client) {
    console.warn('\n⚠️ [Azure Document Intelligence] Credentials missing. Returning baseline extraction.');
    return {
      extracted: {
        vendorName: 'Sample Vendor (Configure Azure AI Key)',
        invoiceNumber: 'INV-SAMPLE-001',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: 'USD',
        subtotal: 100.0,
        taxAmount: 10.0,
        discountAmount: 0.0,
        totalAmount: 110.0,
        lineItems: [
          { description: 'Professional Services', quantity: 1, unitPrice: 100.0, totalAmount: 100.0 },
        ],
      },
      confidence: 0.95,
      isSimulated: true,
      raw: {},
    };
  }

  // Real Azure Document Intelligence Analysis
  const poller = await client.beginAnalyzeDocument('prebuilt-invoice', buffer);
  const result = await poller.pollUntilDone();

  const documents = result.documents || [];
  if (documents.length === 0) {
    throw new Error('Azure Document Intelligence could not detect any document structure.');
  }

  const doc = documents[0];
  const fields = doc.fields || {};

  const getField = (name) => {
    const f = fields[name];
    if (!f) return { value: null, content: null, confidence: 0 };
    return {
      value: f.value,
      content: f.content,
      confidence: f.confidence || 0,
    };
  };

  const lineItems = [];
  if (fields.Items && Array.isArray(fields.Items.values)) {
    for (const item of fields.Items.values) {
      const itemFields = item.properties || {};
      lineItems.push({
        description: itemFields.Description?.content || itemFields.Description?.value || null,
        quantity: itemFields.Quantity?.value !== undefined ? Number(itemFields.Quantity.value) : null,
        unitPrice: itemFields.UnitPrice?.value?.amount !== undefined ? Number(itemFields.UnitPrice.value.amount) : null,
        totalAmount: itemFields.Amount?.value?.amount !== undefined ? Number(itemFields.Amount.value.amount) : null,
        taxAmount: itemFields.Tax?.value?.amount !== undefined ? Number(itemFields.Tax.value.amount) : null,
      });
    }
  }

  const subtotalObj = getField('SubTotal');
  const taxObj = getField('TotalTax');
  const totalObj = getField('InvoiceTotal');
  const vendorObj = getField('VendorName');
  const invoiceIdObj = getField('InvoiceId');
  const invoiceDateObj = getField('InvoiceDate');
  const dueDateObj = getField('DueDate');

  const overallConfidence = doc.confidence || 0.85;

  return {
    extracted: {
      vendorName: vendorObj.value || vendorObj.content || null,
      vendorAddress: getField('VendorAddress').content || null,
      vendorTaxNumber: getField('VendorTaxId').value || null,
      customerName: getField('CustomerName').value || null,
      customerAddress: getField('CustomerAddress').content || null,
      invoiceNumber: invoiceIdObj.value || invoiceIdObj.content || null,
      invoiceDate: invoiceDateObj.value ? new Date(invoiceDateObj.value) : null,
      dueDate: dueDateObj.value ? new Date(dueDateObj.value) : null,
      purchaseOrderNumber: getField('PurchaseOrder').value || null,
      currency: totalObj.value?.currencyCode || 'USD',
      subtotal: subtotalObj.value?.amount !== undefined ? Number(subtotalObj.value.amount) : null,
      taxAmount: taxObj.value?.amount !== undefined ? Number(taxObj.value.amount) : null,
      totalAmount: totalObj.value?.amount !== undefined ? Number(totalObj.value.amount) : null,
      lineItems,
    },
    confidence: overallConfidence,
    raw: doc,
  };
}
