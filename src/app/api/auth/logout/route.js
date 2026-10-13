// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/logout
// Revokes the current session and clears HTTP-only cookie
// ─────────────────────────────────────────────────────────────────

import { destroySession } from '@/lib/auth';
import { apiResponse } from '@/lib/utils';

export async function POST() {
  try {
    await destroySession();
    return apiResponse({
      success: true,
      message: 'Signed out successfully.',
    });
  } catch (error) {
    console.error('Error in logout route:', error);
    return apiResponse({ success: true }); // Always allow client to treat logout as successful
  }
}
