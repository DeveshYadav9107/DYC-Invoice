// ─────────────────────────────────────────────────────────────────
// Upload Middleware — Multer memory storage with file validation
// ─────────────────────────────────────────────────────────────────

import multer from 'multer';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
];

const maxMb = parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10);
const MAX_FILE_SIZE = maxMb * 1024 * 1024;

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file format (${file.mimetype}). Please upload a PDF, PNG, JPEG, or TIFF document.`
      ),
      false
    );
  }
}

export const uploadInvoice = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
