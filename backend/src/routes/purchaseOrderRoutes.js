// ─────────────────────────────────────────────────────────────────
// Purchase Order Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as poController from '../controllers/purchaseOrderController.js';
import { requireSession, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

// List and view POs
router.get('/', poController.getPurchaseOrders);
router.get('/:id', poController.getPurchaseOrderById);

// Admin-only management endpoints
router.post('/', requireAdmin, poController.createPurchaseOrder);
router.patch('/:id', requireAdmin, poController.updatePurchaseOrder);
router.post('/:id/issue', requireAdmin, poController.issuePurchaseOrder);
router.post('/:id/close', requireAdmin, poController.closePurchaseOrder);
router.post('/:id/cancel', requireAdmin, poController.cancelPurchaseOrder);

export default router;
