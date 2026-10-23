// ─────────────────────────────────────────────────────────────────
// Auth Middleware — Session Validation & Role-based Authorization
// ─────────────────────────────────────────────────────────────────

import { SESSION_COOKIE_NAME, validateSession } from '../services/authService.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Requires a valid session cookie. Attaches user and session to request.
 */
export async function requireSession(req, res, next) {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken) {
      return errorResponse(res, 'Authentication required. Please log in.', 401);
    }

    const sessionData = await validateSession(rawToken);

    if (!sessionData || !sessionData.user) {
      return errorResponse(res, 'Session expired or invalid. Please log in again.', 401);
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    return next();
  } catch (error) {
    console.error('Session authentication error:', error);
    return errorResponse(res, 'Authentication verification failed.', 401);
  }
}

/**
 * Requires an active session with ADMIN role.
 */
export async function requireAdmin(req, res, next) {
  await requireSession(req, res, async () => {
    if (req.user?.role !== 'ADMIN') {
      return errorResponse(res, 'Access denied. Administrator privileges required.', 403);
    }
    return next();
  });
}

/**
 * Optional session check: populates req.user if session cookie is valid.
 */
export async function optionalSession(req, res, next) {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      const sessionData = await validateSession(rawToken);
      if (sessionData?.user) {
        req.user = sessionData.user;
        req.session = sessionData.session;
      }
    }
  } catch (err) {
    // Ignore optional session errors
  }
  return next();
}
