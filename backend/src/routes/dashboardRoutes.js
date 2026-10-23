// ─────────────────────────────────────────────────────────────────
// Dashboard Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireSession } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

router.get('/stats', dashboardController.getDashboardStats);

export default router;
