// ─────────────────────────────────────────────────────────────────
// Item Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as itemController from '../controllers/itemController.js';
import { requireSession, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

// List and view items
router.get('/', itemController.getItems);
router.get('/:id', itemController.getItemById);

// Admin-only management endpoints
router.post('/', requireAdmin, itemController.createItem);
router.patch('/:id', requireAdmin, itemController.updateItem);
router.delete('/:id', requireAdmin, itemController.deleteItem);

export default router;
