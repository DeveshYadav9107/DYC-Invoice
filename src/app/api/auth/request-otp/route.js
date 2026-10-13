// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/request-otp
// Generates and sends a 6-digit OTP to the requested email
// ─────────────────────────────────────────────────────────────────

import { createOtpChallenge } from '@/services/otp';
import { sendOtpEmail } from '@/services/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeEmail, apiResponse, apiError } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return apiError('Please provide a valid email address.', 400);
    }

    const normalizedEmail = normalizeEmail(email);

    // Rate limit: max 5 requests per 5 minutes per email
    const emailLimit = checkRateLimit(`otp-req:${normalizedEmail}`, 5, 5 * 60 * 1000);
    if (!emailLimit.success) {
      const waitSeconds = Math.ceil(emailLimit.resetMs / 1000);
      return apiError(
        `Too many requests. Please wait ${waitSeconds} seconds before trying again.`,
        429
      );
    }

    // Create challenge in database
    const challenge = await createOtpChallenge(normalizedEmail);

    // Send code via email
    await sendOtpEmail(normalizedEmail, challenge.code);

    return apiResponse({
      success: true,
      message: 'Verification code sent successfully.',
    });
  } catch (error) {
    console.error('Error in request-otp route:', error);
    return apiError(error.message || 'Failed to send verification code.', 400);
  }
}
