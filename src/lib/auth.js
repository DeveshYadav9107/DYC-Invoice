// ─────────────────────────────────────────────────────────────────
// Session Management — Server-side session handling
// Uses database-backed sessions with hashed tokens stored in cookies
// ─────────────────────────────────────────────────────────────────

import { cookies } from 'next/headers';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

const SESSION_COOKIE_NAME = 'invoiceflow_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hashes a session token for secure storage.
 * We never store the raw token in the database — only its hash.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new session for a user.
 * Generates a random token, stores its hash in the DB,
 * and sets an HTTP-only cookie with the raw token.
 */
export async function createSession(userId) {
  // Generate a cryptographically secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Save session hash in database
  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: tokenHash,
      expiresAt,
    },
  });

  // Set HTTP-only cookie with the raw token
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { tokenHash, expiresAt };
}

/**
 * Retrieves the current session and user from the session cookie.
 * Returns { user, session } or null if no valid session exists.
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!rawToken) return null;

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

    // Check if session is expired or revoked
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
 * Destroys the current session — revokes it in DB and clears the cookie.
 */
export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);

      // Mark session as revoked in database
      await prisma.session.updateMany({
        where: { sessionTokenHash: tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    // Clear the cookie
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ensure cookie is cleared even if DB operation fails
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

/**
 * Requires a valid session. Returns the user or throws/redirects.
 * Use in server components and route handlers.
 */
export async function requireSession() {
  const result = await getSession();
  if (!result) {
    return null;
  }
  return result;
}

/**
 * Requires an admin session. Returns the user or null.
 */
export async function requireAdmin() {
  const result = await getSession();
  if (!result || result.user.role !== 'ADMIN') {
    return null;
  }
  return result;
}
