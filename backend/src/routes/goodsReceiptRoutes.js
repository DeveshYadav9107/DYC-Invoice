// ─────────────────────────────────────────────────────────────────
// Goods Receipt Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as grController from '../controllers/goodsReceiptController.js';
import { requireSession, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

// List and view Goods Receipts
router.get('/', grController.getGoodsReceipts);
router.get('/:id', grController.getGoodsReceiptById);

// Admin-only creation and cancellation
router.post('/', requireAdmin, grController.createGoodsReceipt);
router.delete('/:id', requireAdmin, grController.deleteGoodsReceipt);

export default router;
