// ─────────────────────────────────────────────────────────────────
// Error Middleware — Centralized error and 404 handler
// ─────────────────────────────────────────────────────────────────

import multer from 'multer';
import { errorResponse } from '../utils/apiResponse.js';

export function notFoundHandler(req, res) {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10);
      return errorResponse(res, `File size exceeds maximum allowed limit of ${maxMb}MB.`, 400);
    }
    return errorResponse(res, `File upload error: ${err.message}`, 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error occurred.';

  return errorResponse(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
}
