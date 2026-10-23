// ─────────────────────────────────────────────────────────────────
// Auth Routes — Express Router
// ─────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireSession } from '../middleware/authMiddleware.js';
import { rateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

const authRateLimiter = rateLimiter({
  prefix: 'auth',
  limit: 10,
  windowMs: 5 * 60 * 1000,
  keyGenerator: (req) => req.body?.email || req.ip,
});

router.post('/register', authRateLimiter, authController.register);
router.post('/login-request', authRateLimiter, authController.loginRequest);
router.post('/request-otp', authRateLimiter, authController.requestOtp);
router.post('/verify-otp', authRateLimiter, authController.verifyOtp);

router.get('/me', requireSession, authController.getMe);
router.post('/logout', authController.logout);
router.post('/complete-signup', requireSession, authController.completeSignup);

export default router;
