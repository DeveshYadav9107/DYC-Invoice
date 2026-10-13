// ─────────────────────────────────────────────────────────────────
// API Route: POST /api/auth/complete-signup
// Sets user name and creates organization for new accounts
// ─────────────────────────────────────────────────────────────────

import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { slugify, apiResponse, apiError } from '@/lib/utils';

export async function POST(request) {
  try {
    const sessionData = await getSession();

    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized. Please log in first.', 401);
    }

    const { user } = sessionData;
    const body = await request.json().catch(() => ({}));
    const { name, organizationName } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return apiError('Name is required.', 400);
    }

    if (!organizationName || typeof organizationName !== 'string' || !organizationName.trim()) {
      return apiError('Company / organization name is required.', 400);
    }

    const trimmedName = name.trim();
    const trimmedOrgName = organizationName.trim();

    // Check if user already has an organization
    let organizationId = user.organizationId;
    let organization = null;

    if (!organizationId) {
      // Generate a unique slug for the organization
      const baseSlug = slugify(trimmedOrgName) || 'org';
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter += 1;
      }

      // Create new organization
      organization = await prisma.organization.create({
        data: {
          name: trimmedOrgName,
          slug,
        },
      });

      organizationId = organization.id;
    } else {
      // Update existing organization name if needed
      organization = await prisma.organization.update({
        where: { id: organizationId },
        data: { name: trimmedOrgName },
      });
    }

    // Update user with full name and organization link
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: trimmedName,
        organizationId: organizationId,
      },
      include: { organization: true },
    });

    return apiResponse({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId,
        organizationName: updatedUser.organization?.name,
      },
    });
  } catch (error) {
    console.error('Error in complete-signup route:', error);
    return apiError(error.message || 'Failed to complete profile.', 500);
  }
}
