// ─────────────────────────────────────────────────────────────────
// API Route: PATCH /api/settings
// Update user profile, DOB, gender, address, designation, phone, and password
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { apiResponse, apiError } from '@/lib/utils';

export async function PATCH(request) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    const body = await request.json().catch(() => ({}));
    const {
      name,
      phoneNumber,
      dateOfBirth,
      gender,
      address,
      designation,
      password,
      confirmPassword,
    } = body;

    const userUpdateData = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return apiError('Name cannot be empty.', 400);
      }
      userUpdateData.name = trimmedName;
    }

    if (phoneNumber !== undefined) {
      userUpdateData.phoneNumber = String(phoneNumber).trim() || null;
    }

    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const parsedDate = new Date(dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          return apiError('Invalid Date of Birth format.', 400);
        }
        userUpdateData.dateOfBirth = parsedDate;
      } else {
        userUpdateData.dateOfBirth = null;
      }
    }

    if (gender !== undefined) {
      userUpdateData.gender = String(gender).trim() || null;
    }

    if (address !== undefined) {
      userUpdateData.address = String(address).trim() || null;
    }

    if (designation !== undefined) {
      userUpdateData.designation = String(designation).trim() || null;
    }

    if (password) {
      if (password.length < 6) {
        return apiError('Password must be at least 6 characters long.', 400);
      }
      if (confirmPassword && password !== confirmPassword) {
        return apiError('New password and confirm password do not match.', 400);
      }
      userUpdateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user in database
    let updatedUser = user;
    if (Object.keys(userUpdateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    return apiResponse({
      success: true,
      message: 'User profile updated successfully.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        dateOfBirth: updatedUser.dateOfBirth ? updatedUser.dateOfBirth.toISOString().slice(0, 10) : null,
        gender: updatedUser.gender,
        address: updatedUser.address,
        designation: updatedUser.designation,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return apiError(error.message || 'Failed to update settings.', 500);
  }
}
