'use client';

// ─────────────────────────────────────────────────────────────────
// Invoices Upload Page — Drag-and-drop invoice upload interface
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import Card, { CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatFileSize } from '@/lib/utils';
import {
  Upload,
  FileText,
  FileCheck,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
];

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function InvoiceUploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateAndAddFiles = useCallback((files) => {
    setErrorMessage('');
    const valid = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setErrorMessage(`"${file.name}" is not a supported format. Please upload PDF, PNG, JPG, or TIFF.`);
        hasError = true;
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`);
        hasError = true;
        return;
      }
      valid.push(file);
    });

    if (!hasError || valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        validateAndAddFiles(e.dataTransfer.files);
      }
    },
    [validateAndAddFiles]
  );

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      setErrorMessage('');
    }
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setErrorMessage('');
    setUploadProgress(10);
    const results = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/invoices', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          results.push({ name: file.name, success: true, invoice: data.invoice });
        } else {
          results.push({ name: file.name, success: false, error: data.error });
        }

        const pct = Math.round(((i + 1) / selectedFiles.length) * 100);
        setUploadProgress(pct);
      }

      setUploadResults(results);
      setSelectedFiles([]);
    } catch {
      setErrorMessage('Network connection lost during upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
          Upload Invoices
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload invoice PDFs or images to start AI extraction, classification, and validation checks.
        </p>
      </div>

      {/* ─── Dropzone Card ─────────────────────────────────────── */}
      <Card>
        <CardBody className="p-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center
              ${dragActive
                ? 'border-brand-500 bg-brand-50/50 scale-[0.99]'
                : 'border-gray-200 bg-gray-50/40 hover:bg-gray-50/80 hover:border-gray-300'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              onChange={(e) => {
                if (e.target.files) validateAndAddFiles(e.target.files);
              }}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white mb-4 shadow-md">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-base font-semibold text-navy-900 mb-1">
              Drag & drop invoice files here, or <span className="text-brand-600 hover:underline">browse</span>
            </h3>
            <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
              Supports PDF, PNG, JPG, JPEG, and TIFF documents up to {MAX_SIZE_MB}MB each.
            </p>

            <div className="flex items-center gap-2 mt-6 text-[11px] font-medium text-gray-400 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
              <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
              Automated Azure AI Document Intelligence extraction upon upload
            </div>
          </div>

          {/* Error alert */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {/* ─── Selected Files Queue ───────────────────────────── */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-gray-100 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <span>Selected Files ({selectedFiles.length})</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles([]);
                    }}
                    className="text-rose-600 hover:text-rose-700 normal-case"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
                        <span className="font-medium text-navy-900 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        disabled={uploading}
                        className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {uploading && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-medium text-navy-700">
                      <span>Uploading to secure storage...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-600 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    onClick={handleUploadAll}
                    loading={uploading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    {uploading ? 'Processing uploads...' : `Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Upload Results ─────────────────────────────────── */}
          {uploadResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-gray-100 space-y-4"
            >
              <h4 className="text-sm font-semibold text-navy-900">Upload Summary</h4>
              <div className="space-y-2">
                {uploadResults.map((res, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-sm ${res.success
                        ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900'
                        : 'bg-rose-50/60 border-rose-100 text-rose-900'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {res.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{res.name}</span>
                    </div>

                    {res.success ? (
                      <Link
                        href={`/invoices`}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 flex-shrink-0"
                      >
                        View in Queue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-rose-600 flex-shrink-0">{res.error}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setUploadResults(null)}
                  className="flex-1"
                >
                  Upload More Files
                </Button>
                <Link href="/invoices" className="flex-1">
                  <Button variant="primary" className="w-full">
                    Go to Invoices
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
