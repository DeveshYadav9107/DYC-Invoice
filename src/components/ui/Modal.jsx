'use client';

// ─────────────────────────────────────────────────────────────────
// Modal Component — Animated dialog with focus and backdrop
// ─────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'relative w-full rounded-3xl bg-white p-6 sm:p-8 shadow-elevated border border-gray-100 z-10',
              maxWidth
            )}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                {title && <h3 className="text-lg font-bold text-navy-900">{title}</h3>}
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-navy-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
