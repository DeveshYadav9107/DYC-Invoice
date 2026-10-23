// ─────────────────────────────────────────────────────────────────
// Admin Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/overview', adminController.getAdminOverview);
router.get('/users', adminController.getAdminUsers);
router.get('/organizations', adminController.getAdminOrganizations);

export default router;
