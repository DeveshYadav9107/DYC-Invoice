// ─────────────────────────────────────────────────────────────────
// Settings Controller — Profile & Connected Services
// ─────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * GET /api/settings
 */
export async function getSettings(req, res) {
  try {
    const user = req.user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        designation: true,
        role: true,
        createdAt: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const integrations = user.role === 'ADMIN' ? [
      {
        name: 'PostgreSQL Database',
        service: 'Neon Serverless',
        configured: Boolean(process.env.DATABASE_URL),
        iconName: 'Database',
        details: process.env.DATABASE_URL ? 'Connected to Neon pooler' : 'Missing DATABASE_URL',
      },
      {
        name: 'Azure AI Document Intelligence',
        service: 'Prebuilt Invoice OCR',
        configured: Boolean(process.env.DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.DOCUMENT_INTELLIGENCE_KEY),
        iconName: 'Cpu',
        details: process.env.DOCUMENT_INTELLIGENCE_ENDPOINT
          ? 'Endpoint active'
          : 'Set DOCUMENT_INTELLIGENCE_KEY in backend environment',
      },
      {
        name: 'Azure Blob Storage',
        service: 'Private container "invoices"',
        configured: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING),
        iconName: 'Cloud',
        details: process.env.AZURE_STORAGE_CONNECTION_STRING
          ? 'Connected to Azure container'
          : 'Running on local dev storage (.storage/invoices/)',
      },
      {
        name: 'SMTP Email Delivery',
        service: 'Passwordless OTP Delivery',
        configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
        iconName: 'Mail',
        details: process.env.SMTP_HOST
          ? `Configured via ${process.env.SMTP_HOST}`
          : 'Dev Mode active (codes logged to server console)',
      },
    ] : [];

    return successResponse(res, {
      user: {
        ...dbUser,
        dateOfBirth: dbUser?.dateOfBirth ? dbUser.dateOfBirth.toISOString().slice(0, 10) : '',
      },
      integrations,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return errorResponse(res, error.message || 'Failed to fetch settings.', 500);
  }
}

/**
 * PATCH /api/settings
 */
export async function updateSettings(req, res) {
  try {
    const user = req.user;
    const body = req.body || {};
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
        return errorResponse(res, 'Name cannot be empty.', 400);
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
          return errorResponse(res, 'Invalid Date of Birth format.', 400);
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
        return errorResponse(res, 'Password must be at least 6 characters long.', 400);
      }
      if (confirmPassword && password !== confirmPassword) {
        return errorResponse(res, 'New password and confirm password do not match.', 400);
      }
      userUpdateData.passwordHash = await bcrypt.hash(password, 10);
    }

    let updatedUser = user;
    if (Object.keys(userUpdateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    return successResponse(res, {
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
    }, 'User profile updated successfully.');
  } catch (error) {
    console.error('Error updating settings:', error);
    return errorResponse(res, error.message || 'Failed to update settings.', 500);
  }
}
