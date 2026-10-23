// ─────────────────────────────────────────────────────────────────
// Export Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as exportController from '../controllers/exportController.js';
import { requireSession } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

router.get('/', exportController.getExportBatches);
router.post('/', exportController.createExportBatch);
router.get('/:id/download', exportController.downloadExportBatch);

export default router;
