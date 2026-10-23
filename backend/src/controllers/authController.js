// ─────────────────────────────────────────────────────────────────
// Auth Controller — Handles Registration, Login, OTP & Sessions
// ─────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import {
  createOtpChallenge,
  verifyOtpChallenge,
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from '../services/authService.js';
import { sendOtpEmail } from '../services/emailService.js';
import { normalizeEmail, slugify } from '../utils/helpers.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const isProduction = process.env.NODE_ENV === 'production';

function setSessionCookie(res, rawToken, expiresAt) {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax', // 'none' needed if frontend & backend are on different domains in production
    path: '/',
    expires: expiresAt,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

/**
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { name, phoneNumber, email, password, confirmPassword } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse(res, 'Full name is required.', 400);
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return errorResponse(res, 'Phone number is required.', 400);
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse(res, 'Valid email address is required.', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long.', 400);
    }
    if (password !== confirmPassword) {
      return errorResponse(res, 'Passwords do not match. Please re-enter your password.', 400);
    }

    const trimmedName = name.trim();
    const trimmedPhone = phoneNumber.trim();
    const normalizedEmail = normalizeEmail(email);

    // Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser && existingUser.emailVerifiedAt && existingUser.passwordHash) {
      return errorResponse(res, 'An account with this email already exists. Please log in.', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const adminEmail = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
    const isAdmin = adminEmail && normalizedEmail === adminEmail;

    if (existingUser) {
      let orgId = existingUser.organizationId;
      if (!orgId) {
        const baseSlug = slugify(trimmedName) || 'workspace';
        let slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
        const org = await prisma.organization.create({
          data: { name: `${trimmedName}'s Organization`, slug },
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
      const baseSlug = slugify(trimmedName) || 'workspace';
      let slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

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
          emailVerifiedAt: null,
        },
      });
    }

    // Generate & send OTP
    const challenge = await createOtpChallenge(normalizedEmail);
    await sendOtpEmail(normalizedEmail, challenge.code);

    return successResponse(res, {}, 'Account details saved. Verification code sent to your email.');
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse(res, error.message || 'Registration failed. Please try again.', 500);
  }
}

/**
 * POST /api/auth/login-request
 */
export async function loginRequest(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse(res, 'Please enter a valid email address.', 400);
    }
    if (!password || typeof password !== 'string') {
      return errorResponse(res, 'Please enter your password.', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return errorResponse(res, 'No account found with this email. Please sign up first.', 404);
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return errorResponse(res, 'Incorrect password. Please try again.', 401);
      }
    } else {
      // For seed or existing accounts created prior to password requirement,
      // save entered password as their new passwordHash
      const newHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    const challenge = await createOtpChallenge(normalizedEmail);
    await sendOtpEmail(normalizedEmail, challenge.code);

    return successResponse(res, {}, 'Credentials verified. Verification code sent to your email.');
  } catch (error) {
    console.error('Login request error:', error);
    return errorResponse(res, error.message || 'Failed to initiate login.', 500);
  }
}

/**
 * POST /api/auth/request-otp (Resend or direct OTP)
 */
export async function requestOtp(req, res) {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse(res, 'Please provide a valid email address.', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const challenge = await createOtpChallenge(normalizedEmail);
    await sendOtpEmail(normalizedEmail, challenge.code);

    return successResponse(res, {}, 'Verification code sent successfully.');
  } catch (error) {
    console.error('Request OTP error:', error);
    return errorResponse(res, error.message || 'Failed to send verification code.', 400);
  }
}

/**
 * POST /api/auth/verify-otp
 */
export async function verifyOtp(req, res) {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return errorResponse(res, 'Email and verification code are required.', 400);
    }

    const normalizedEmail = normalizeEmail(email);
    const result = await verifyOtpChallenge(normalizedEmail, code);

    if (!result.success) {
      return errorResponse(res, result.error || 'Invalid verification code.', 400);
    }

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { organization: true },
    });

    const adminEmail = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
    const isAdmin = adminEmail && normalizedEmail === adminEmail;

    if (!user) {
      const org = await prisma.organization.create({
        data: {
          name: 'My Organization',
          slug: `org-${Date.now().toString().slice(-6)}`,
        },
      });

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          role: isAdmin ? 'ADMIN' : 'CLIENT',
          organizationId: org.id,
          emailVerifiedAt: new Date(),
        },
        include: { organization: true },
      });
    } else {
      const updateData = {};
      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }
      if (!user.organizationId) {
        const org = await prisma.organization.create({
          data: {
            name: `${user.name || 'My'} Organization`,
            slug: `org-${Date.now().toString().slice(-6)}`,
          },
        });
        updateData.organizationId = org.id;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { organization: true },
        });
      }
    }

    // Create session and set cookie
    const { rawToken, expiresAt } = await createSession(user.id);
    setSessionCookie(res, rawToken, expiresAt);

    return successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name || null,
      },
    }, 'Authentication successful.');
  } catch (error) {
    console.error('Verify OTP error:', error);
    return errorResponse(res, error.message || 'Verification failed.', 500);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(req, res) {
  const user = req.user;
  if (!user) {
    return errorResponse(res, 'Not authenticated.', 401);
  }

  return successResponse(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name || null,
    },
  });
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      await revokeSession(rawToken);
    }
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    clearSessionCookie(res);
    return successResponse(res, {}, 'Signed out successfully.');
  }
}

/**
 * POST /api/auth/complete-signup
 */
export async function completeSignup(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return errorResponse(res, 'Unauthorized. Please log in first.', 401);
    }

    const { name, organizationName } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return errorResponse(res, 'Name is required.', 400);
    }
    if (!organizationName || typeof organizationName !== 'string' || !organizationName.trim()) {
      return errorResponse(res, 'Company / organization name is required.', 400);
    }

    const trimmedName = name.trim();
    const trimmedOrgName = organizationName.trim();

    let organizationId = user.organizationId;

    if (!organizationId) {
      const baseSlug = slugify(trimmedOrgName) || 'org';
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter += 1;
      }

      const organization = await prisma.organization.create({
        data: { name: trimmedOrgName, slug },
      });
      organizationId = organization.id;
    } else {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { name: trimmedOrgName },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: trimmedName,
        organizationId,
      },
      include: { organization: true },
    });

    return successResponse(res, {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId,
        organizationName: updatedUser.organization?.name,
      },
    }, 'Profile completed successfully.');
  } catch (error) {
    console.error('Complete signup error:', error);
    return errorResponse(res, error.message || 'Failed to complete profile.', 500);
  }
}
