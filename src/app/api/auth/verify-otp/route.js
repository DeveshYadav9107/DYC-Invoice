// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/verify-otp
// Verifies OTP, provisions user if new, creates session cookie
// ─────────────────────────────────────────────────────────────────

import { verifyOtp } from '@/services/otp';
import { createSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeEmail, apiResponse, apiError } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, code } = body;

    if (!email || !code) {
      return apiError('Email and verification code are required.', 400);
    }

    const normalizedEmail = normalizeEmail(email);

    // Rate limit: max 10 attempts per 5 minutes per email
    const rateCheck = checkRateLimit(`otp-verify:${normalizedEmail}`, 10, 5 * 60 * 1000);
    if (!rateCheck.success) {
      return apiError('Too many verification attempts. Please try again later.', 429);
    }

    // Verify OTP against stored challenge
    const result = await verifyOtp(normalizedEmail, code);
    if (!result.success) {
      return apiError(result.error || 'Invalid verification code.', 400);
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { organization: true },
    });

    const adminEmail = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
    const isAdmin = adminEmail && normalizedEmail === adminEmail;

    if (!user) {
      // Provision new user
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: '',
          role: isAdmin ? 'ADMIN' : 'CLIENT',
          emailVerifiedAt: new Date(),
        },
        include: { organization: true },
      });
    } else if (!user.emailVerifiedAt) {
      // Update email verified timestamp
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
        include: { organization: true },
      });
    }

    // Establish persistent session
    await createSession(user.id);

    // Check if user needs to complete profile (has name and organization)
    const needsProfile = !user.name || (!user.organizationId && user.role !== 'ADMIN');

    return apiResponse({
      success: true,
      needsProfile,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name || null,
      },
    });
  } catch (error) {
    console.error('Error in verify-otp route:', error);
    return apiError(error.message || 'Verification failed.', 500);
  }
}
