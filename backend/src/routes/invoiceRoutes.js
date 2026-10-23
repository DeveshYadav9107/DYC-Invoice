// ─────────────────────────────────────────────────────────────────
// Invoice Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as invoiceController from '../controllers/invoiceController.js';
import { requireSession } from '../middleware/authMiddleware.js';
import { uploadInvoice } from '../middleware/uploadMiddleware.js';

const router = Router();

router.use(requireSession);

// List invoices & upload new invoice
router.get('/', invoiceController.getInvoices);
router.post('/', uploadInvoice.single('file'), invoiceController.uploadInvoice);

// Single invoice operations
router.get('/:id', invoiceController.getInvoiceById);
router.patch('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);

// Document stream & actions
router.get('/:id/file', invoiceController.streamInvoiceFile);
router.post('/:id/retry', invoiceController.retryProcessing);
router.post('/:id/revalidate', invoiceController.revalidateInvoiceHandler);
router.get('/:id/export', invoiceController.exportSingleInvoice);

export default router;
