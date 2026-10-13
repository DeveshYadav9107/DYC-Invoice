import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('Rate Limiter', () => {
  it('should allow requests within limit and block when exceeded', () => {
    const key = `test-${Date.now()}`;
    const limit = 3;
    const windowMs = 5000;

    // First 3 requests should pass
    const r1 = checkRateLimit(key, limit, windowMs);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, limit, windowMs);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, limit, windowMs);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request must be blocked
    const r4 = checkRateLimit(key, limit, windowMs);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetMs).toBeGreaterThan(0);
  });
});
