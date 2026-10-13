// ─────────────────────────────────────────────────────────────────
// OTP Service — One-Time Password Generation, Hashing & Verification
// ─────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { normalizeEmail } from '@/lib/utils';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Hashes an OTP code with the server AUTH_SECRET for secure DB storage.
 * Plaintext OTP is never stored in the database.
 */
export function hashOtp(code, email) {
  const secret = process.env.AUTH_SECRET || 'fallback-secret-for-dev-only-change-in-production';
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}:${code}`)
    .digest('hex');
}

/**
 * Generates a cryptographically secure 6-digit OTP code.
 */
export function generateOtpCode() {
  const min = 100000;
  const max = 999999;
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Creates and stores a new OTP challenge for the given email.
 * Enforces resend cooldown to prevent abuse.
 */
export async function createOtpChallenge(rawEmail) {
  const normalizedEmail = normalizeEmail(rawEmail);

  if (!normalizedEmail) {
    throw new Error('Valid email address is required.');
  }

  // Check for recent challenge to enforce cooldown
  const recentChallenge = await prisma.otpChallenge.findFirst({
    where: {
      normalizedEmail,
      consumedAt: null,
      resendAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentChallenge) {
    const secondsRemaining = Math.ceil((recentChallenge.resendAt.getTime() - Date.now()) / 1000);
    throw new Error(`Please wait ${secondsRemaining}s before requesting a new code.`);
  }

  // Generate new code and hash
  const code = generateOtpCode();
  const codeHash = hashOtp(code, normalizedEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

  // Invalidate any older unconsumed challenges for this email
  await prisma.otpChallenge.updateMany({
    where: {
      normalizedEmail,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  // Create new challenge record
  const challenge = await prisma.otpChallenge.create({
    data: {
      normalizedEmail,
      codeHash,
      expiresAt,
      resendAt,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
    },
  });

  return {
    challengeId: challenge.id,
    code, // Return code so caller can send it via email (never logged or stored raw)
    expiresAt,
    normalizedEmail,
  };
}

/**
 * Verifies a submitted OTP against the latest active challenge.
 */
export async function verifyOtp(rawEmail, inputCode) {
  const normalizedEmail = normalizeEmail(rawEmail);
  const cleanCode = (inputCode || '').toString().trim();

  if (!normalizedEmail || cleanCode.length !== OTP_LENGTH) {
    return { success: false, error: 'Invalid verification code format.' };
  }

  // Find latest active challenge for this email
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      normalizedEmail,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge) {
    return {
      success: false,
      error: 'Verification code expired or not found. Please request a new code.',
    };
  }

  // Check max attempts
  if (challenge.attempts >= challenge.maxAttempts) {
    // Mark as consumed/invalidated
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  // Check code match using timing-safe comparison
  const expectedHash = challenge.codeHash;
  const providedHash = hashOtp(cleanCode, normalizedEmail);

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const providedBuffer = Buffer.from(providedHash, 'hex');

  const isMatch =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isMatch) {
    const updatedAttempts = challenge.attempts + 1;
    const attemptsLeft = challenge.maxAttempts - updatedAttempts;

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: updatedAttempts },
    });

    if (attemptsLeft <= 0) {
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }

    return {
      success: false,
      error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
    };
  }

  // Code matches! Mark as consumed
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { success: true, normalizedEmail };
}
