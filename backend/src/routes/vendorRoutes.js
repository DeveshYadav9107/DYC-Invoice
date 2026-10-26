// ─────────────────────────────────────────────────────────────────
// Vendor Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as vendorController from '../controllers/vendorController.js';
import { requireSession, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

// List and view vendors (available to all org members)
router.get('/', vendorController.getVendors);
router.get('/:id', vendorController.getVendorById);

// Admin-only management endpoints
router.post('/', requireAdmin, vendorController.createVendor);
router.patch('/:id', requireAdmin, vendorController.updateVendor);
router.delete('/:id', requireAdmin, vendorController.deleteVendor);

export default router;
