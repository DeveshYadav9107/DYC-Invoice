// ─────────────────────────────────────────────────────────────────
// Rate Limit Middleware — In-memory endpoint throttling
// ─────────────────────────────────────────────────────────────────

import { errorResponse } from '../utils/apiResponse.js';

const rateLimitStore = new Map();

/**
 * Creates an Express middleware for rate-limiting requests by key.
 */
export function rateLimiter({ prefix = 'rl', limit = 5, windowMs = 5 * 60 * 1000, keyGenerator } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const identifier = keyGenerator ? keyGenerator(req) : (req.ip || 'anonymous');
    const cleanKey = `${prefix}:${String(identifier).trim().toLowerCase()}`;

    // Periodically prune stale entries
    if (rateLimitStore.size > 10000) {
      for (const [k, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
          rateLimitStore.delete(k);
        }
      }
    }

    const record = rateLimitStore.get(cleanKey);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(cleanKey, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= limit) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
      return errorResponse(
        res,
        `Too many requests. Please wait ${waitSeconds}s before trying again.`,
        429
      );
    }

    record.count += 1;
    return next();
  };
}
