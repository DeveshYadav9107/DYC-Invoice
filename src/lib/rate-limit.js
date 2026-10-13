// ─────────────────────────────────────────────────────────────────
// Rate Limiter — Lightweight in-memory rate limiting
// Protects authentication endpoints from brute force and flooding
// ─────────────────────────────────────────────────────────────────

const ipRequests = new Map();

/**
 * Checks if a given key (e.g. IP or email) has exceeded rate limits.
 * @param {string} key - Identifier (IP address or email)
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ success: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(key, limit = 5, windowMs = 60 * 1000) {
  const now = Date.now();
  const cleanKey = String(key || 'anonymous').trim().toLowerCase();

  // Clean expired entries periodically
  if (ipRequests.size > 10000) {
    for (const [k, data] of ipRequests.entries()) {
      if (now > data.resetTime) {
        ipRequests.delete(k);
      }
    }
  }

  const record = ipRequests.get(cleanKey);

  if (!record || now > record.resetTime) {
    ipRequests.set(cleanKey, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetMs: record.resetTime - now,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: limit - record.count,
    resetMs: record.resetTime - now,
  };
}
