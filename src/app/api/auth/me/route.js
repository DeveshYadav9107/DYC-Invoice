// ─────────────────────────────────────────────────────────────────
// API Route: GET /api/auth/me
// Returns current authenticated user and session info
// ─────────────────────────────────────────────────────────────────

import { getSession } from '@/lib/auth';
import { apiResponse, apiError } from '@/lib/utils';

export async function GET() {
  try {
    const sessionData = await getSession();

    if (!sessionData || !sessionData.user) {
      return apiError('Not authenticated.', 401);
    }

    const { user } = sessionData;

    return apiResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization?.name || null,
      },
    });
  } catch (error) {
    console.error('Error in me route:', error);
    return apiError('Internal server error.', 500);
  }
}
