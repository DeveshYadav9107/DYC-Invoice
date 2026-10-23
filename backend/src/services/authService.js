// ─────────────────────────────────────────────────────────────────
// Auth Service — Passwordless OTP + Session Management
// Uses database-backed sessions with hashed tokens
// ─────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { normalizeEmail } from '../utils/helpers.js';

export const SESSION_COOKIE_NAME = 'invoiceflow_session';
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Hashes an OTP code with AUTH_SECRET for secure DB storage.
 */
export function hashOtp(code, email) {
  const secret = process.env.AUTH_SECRET || 'fallback-secret-for-dev-only-change-in-production';
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}:${code}`)
    .digest('hex');
}

/**
 * Generates a 6-digit OTP code.
 */
export function generateOtpCode() {
  const min = 100000;
  const max = 999999;
  return crypto.randomInt(min, max + 1).toString();
}

/**
 * Creates and stores a new OTP challenge.
 */
export async function createOtpChallenge(rawEmail) {
  const normalizedEmail = normalizeEmail(rawEmail);
  if (!normalizedEmail) {
    throw new Error('Valid email address is required.');
  }

  // Check resend cooldown
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

  const code = generateOtpCode();
  const codeHash = hashOtp(code, normalizedEmail);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

  // Invalidate previous active challenges
  await prisma.otpChallenge.updateMany({
    where: {
      normalizedEmail,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

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
    code,
    expiresAt,
    normalizedEmail,
  };
}

/**
 * Verifies submitted OTP against database challenge.
 */
export async function verifyOtpChallenge(rawEmail, inputCode) {
  const normalizedEmail = normalizeEmail(rawEmail);
  const cleanCode = (inputCode || '').toString().trim();

  if (!normalizedEmail || cleanCode.length !== OTP_LENGTH) {
    return { success: false, error: 'Invalid verification code format.' };
  }

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

  if (challenge.attempts >= challenge.maxAttempts) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

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

  // Success
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { success: true, normalizedEmail };
}

/**
 * Hashes a session token for secure storage.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates database-backed session and returns rawToken for HTTP-only cookie.
 */
export async function createSession(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: tokenHash,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Validates a session token from cookie.
 */
export async function validateSession(rawToken) {
  if (!rawToken) return null;

  try {
    const tokenHash = hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { sessionTokenHash: tokenHash },
      include: {
        user: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!session) return null;

    if (session.expiresAt < new Date() || session.revokedAt) {
      return null;
    }

    return {
      user: session.user,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Revokes a session by marking revokedAt in DB.
 */
export async function revokeSession(rawToken) {
  if (!rawToken) return;

  try {
    const tokenHash = hashToken(rawToken);
    await prisma.session.updateMany({
      where: { sessionTokenHash: tokenHash },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    console.error('Error revoking session:', err);
  }
}
