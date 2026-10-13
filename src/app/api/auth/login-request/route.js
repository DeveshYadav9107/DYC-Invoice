// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/login-request
// Validates credentials (email + password) and dispatches OTP code
// ─────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createOtpChallenge } from '@/services/otp';
import { sendOtpEmail } from '@/services/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeEmail, apiResponse, apiError } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return apiError('Please enter a valid email address.', 400);
    }

    if (!password || typeof password !== 'string') {
      return apiError('Please enter your password.', 400);
    }

    const normalizedEmail = normalizeEmail(email);

    // Rate limiting: max 5 login attempts per 5 minutes per email
    const rateCheck = checkRateLimit(`login-req:${normalizedEmail}`, 5, 5 * 60 * 1000);
    if (!rateCheck.success) {
      const waitSeconds = Math.ceil(rateCheck.resetMs / 1000);
      return apiError(`Too many login attempts. Please wait ${waitSeconds}s before trying again.`, 429);
    }

    // Locate user in database
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return apiError('No account found with this email. Please sign up first.', 404);
    }

    // If user has a passwordHash, verify it with bcrypt
    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return apiError('Incorrect password. Please try again.', 401);
      }
    } else {
      // For seed or existing accounts created prior to password requirement,
      // save this entered password as their new passwordHash
      const newHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    // Generate and send OTP challenge
    const challenge = await createOtpChallenge(normalizedEmail);
    await sendOtpEmail(normalizedEmail, challenge.code);

    return apiResponse({
      success: true,
      message: 'Credentials verified. Verification code sent to your email.',
    });
  } catch (error) {
    console.error('Error in login-request route:', error);
    return apiError(error.message || 'Failed to initiate login.', 500);
  }
}
