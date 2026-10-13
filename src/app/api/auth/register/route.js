// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/register
// User registration with Name, Phone, Email, Password
// Creates organization, hashes password, and dispatches OTP
// ─────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createOtpChallenge } from '@/services/otp';
import { sendOtpEmail } from '@/services/email';
import { checkRateLimit } from '@/lib/rate-limit';
import { normalizeEmail, slugify, apiResponse, apiError } from '@/lib/utils';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, phoneNumber, email, password, confirmPassword } = body;

    // Validate all required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return apiError('Full name is required.', 400);
    }

    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return apiError('Phone number is required.', 400);
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return apiError('Valid email address is required.', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return apiError('Password must be at least 6 characters long.', 400);
    }

    if (password !== confirmPassword) {
      return apiError('Passwords do not match. Please re-enter your password.', 400);
    }

    const trimmedName = name.trim();
    const trimmedPhone = phoneNumber.trim();
    const normalizedEmail = normalizeEmail(email);

    // Rate limiting: max 5 register requests per 5 minutes per email/IP
    const rateCheck = checkRateLimit(`reg:${normalizedEmail}`, 5, 5 * 60 * 1000);
    if (!rateCheck.success) {
      const waitSeconds = Math.ceil(rateCheck.resetMs / 1000);
      return apiError(`Too many attempts. Please wait ${waitSeconds}s before trying again.`, 429);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.emailVerifiedAt && existingUser.passwordHash) {
      return apiError('An account with this email already exists. Please log in.', 400);
    }

    // Hash the password securely
    const passwordHash = await bcrypt.hash(password, 10);

    const adminEmail = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
    const isAdmin = adminEmail && normalizedEmail === adminEmail;

    if (existingUser) {
      // User existed from a prior unverified attempt — update their registration details
      let orgId = existingUser.organizationId;
      if (!orgId) {
        const baseSlug = slugify(trimmedName) || 'workspace';
        let slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
        const org = await prisma.organization.create({
          data: {
            name: `${trimmedName}'s Organization`,
            slug,
          },
        });
        orgId = org.id;
      }

      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: trimmedName,
          phoneNumber: trimmedPhone,
          passwordHash,
          organizationId: orgId,
          role: isAdmin ? 'ADMIN' : existingUser.role,
        },
      });
    } else {
      // Create a brand new tenant organization and user
      const baseSlug = slugify(trimmedName) || 'workspace';
      let slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      // Guarantee unique slug
      if (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }

      const organization = await prisma.organization.create({
        data: {
          name: `${trimmedName}'s Organization`,
          slug,
        },
      });

      await prisma.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          phoneNumber: trimmedPhone,
          passwordHash,
          organizationId: organization.id,
          role: isAdmin ? 'ADMIN' : 'CLIENT',
          emailVerifiedAt: null, // Will be verified upon OTP confirmation
        },
      });
    }

    // Create and dispatch OTP verification challenge
    const challenge = await createOtpChallenge(normalizedEmail);
    await sendOtpEmail(normalizedEmail, challenge.code);

    return apiResponse({
      success: true,
      message: 'Account details saved. Verification code sent to your email.',
    });
  } catch (error) {
    console.error('Error in registration route:', error);
    return apiError(error.message || 'Registration failed. Please try again.', 500);
  }
}
