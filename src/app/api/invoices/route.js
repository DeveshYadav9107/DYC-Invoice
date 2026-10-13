// ─────────────────────────────────────────────────────────────────
// API Route: /api/invoices
// GET: Paginated list with status filters & search
// POST: Multipart file upload to Azure Blob Storage & DB creation
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadInvoiceFile } from '@/services/storage';
import { processUploadedInvoice } from '@/services/invoiceProcessor';
import { apiResponse, apiError } from '@/lib/utils';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
];

const MAX_FILE_SIZE = (parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10)) * 1024 * 1024;

// ─── GET: Fetch Invoices ──────────────────────────────────────────
export async function GET(request) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    const validationStatus = searchParams.get('validationStatus');
    const processingStatus = searchParams.get('processingStatus');
    const search = searchParams.get('search')?.trim();

    // Build Prisma where clause isolated by organization
    const where = {
      organizationId: user.organizationId || undefined,
    };

    if (validationStatus && validationStatus !== 'ALL') {
      where.validationStatus = validationStatus;
    }

    if (processingStatus && processingStatus !== 'ALL') {
      where.processingStatus = processingStatus;
    }

    if (search) {
      where.OR = [
        { originalFileName: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { validationIssues: true, lineItems: true },
          },
        },
      }),
    ]);

    return apiResponse({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return apiError(error.message || 'Failed to fetch invoices.', 500);
  }
}

// ─── POST: Upload Invoice File ────────────────────────────────────
export async function POST(request) {
  try {
    const sessionData = await requireSession();
    if (!sessionData || !sessionData.user) {
      return apiError('Unauthorized.', 401);
    }

    const { user } = sessionData;
    if (!user.organizationId) {
      return apiError('You must be assigned to an organization to upload invoices.', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return apiError('Please select a valid invoice document.', 400);
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        `Unsupported file format (${file.type}). Please upload a PDF, PNG, JPEG, or TIFF document.`,
        400
      );
    }

    // Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      const maxMb = MAX_FILE_SIZE / (1024 * 1024);
      return apiError(`File size exceeds maximum allowed limit of ${maxMb}MB.`, 400);
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Azure Blob Storage / local storage
    const uploadResult = await uploadInvoiceFile(
      buffer,
      file.name,
      file.type,
      user.organizationId
    );

    // Save invoice record in database
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: user.organizationId,
        uploadedById: user.id,
        originalFileName: file.name,
        storageKey: uploadResult.storageKey,
        mimeType: file.type,
        fileSize: uploadResult.sizeBytes,
        fileChecksum: uploadResult.checksum,
        processingStatus: 'UPLOADED',
        classificationStatus: 'PENDING',
        validationStatus: 'PENDING',
      },
    });

    // Fire processing pipeline in background
    processUploadedInvoice(invoice.id).catch((err) => {
      console.error(`Failed to process invoice ${invoice.id}:`, err);
    });

    return apiResponse({
      success: true,
      message: 'Invoice uploaded successfully and queued for processing.',
      invoice: {
        id: invoice.id,
        fileName: invoice.originalFileName,
        fileSize: invoice.fileSize,
        status: invoice.processingStatus,
      },
    }, 201);
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return apiError(error.message || 'Invoice upload failed.', 500);
  }
}
