import { describe, it, expect } from 'vitest';
import { generateOtpCode, hashOtp } from '@/services/otp';

describe('OTP Service', () => {
  it('should generate a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      const num = parseInt(code, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  it('should produce deterministic HMAC hashes for same code and email', () => {
    const email = 'user@example.com';
    const code = '123456';
    const hash1 = hashOtp(code, email);
    const hash2 = hashOtp(code, email);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('should produce different hashes for different codes or emails', () => {
    const hashA = hashOtp('123456', 'a@test.com');
    const hashB = hashOtp('654321', 'a@test.com');
    const hashC = hashOtp('123456', 'b@test.com');

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});
