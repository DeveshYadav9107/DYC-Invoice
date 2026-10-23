// ─────────────────────────────────────────────────────────────────
// Settings Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { requireSession } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireSession);

router.get('/', settingsController.getSettings);
router.patch('/', settingsController.updateSettings);

export default router;
