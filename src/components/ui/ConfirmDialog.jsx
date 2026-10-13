'use client';

// ─────────────────────────────────────────────────────────────────
// ConfirmDialog Component — Action confirmation modal
// ─────────────────────────────────────────────────────────────────

import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-base font-bold text-navy-900">{title}</h4>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          size="sm"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
