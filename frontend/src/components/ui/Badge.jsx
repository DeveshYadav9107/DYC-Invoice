// ─────────────────────────────────────────────────────────────────
// Badge Component — Status and category indicators
// Extended with PO, Goods Receipt, and 3-Way Verification statuses
// ─────────────────────────────────────────────────────────────────

import { cn } from '../../utils/helpers.js';

const variantStyles = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

const dotColors = {
  default: 'bg-gray-400',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
  purple: 'bg-purple-500',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border tracking-wide transition-colors',
        variantStyles[variant] || variantStyles.default,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse',
            dotColors[variant] || dotColors.default
          )}
        />
      )}
      {children}
    </span>
  );
}

export function getStatusBadgeProps(status) {
  switch (status) {
    case 'MATCHED':
    case 'VALIDATED':
    case 'FULLY_RECEIVED':
    case 'COMPLETED':
      return {
        variant: 'success',
        label: status === 'MATCHED' ? '3-Way Matched' : status === 'FULLY_RECEIVED' ? 'Fully Received' : 'Completed',
        dot: true,
      };

    case 'PARTIALLY_RECEIVED':
      return { variant: 'warning', label: 'Partially Received', dot: true };

    case 'ISSUED':
    case 'SUBMITTED':
      return { variant: 'brand', label: status === 'ISSUED' ? 'Issued' : 'Submitted', dot: true };

    case 'NEEDS_PO_SELECTION':
      return { variant: 'purple', label: 'Needs PO Selection', dot: true };

    case 'NEEDS_REVIEW':
    case 'UNCERTAIN':
      return { variant: 'warning', label: status === 'NEEDS_REVIEW' ? 'Needs Review' : 'Uncertain', dot: true };

    case 'MISMATCH':
    case 'REJECTED':
    case 'FAILED':
    case 'OVERBILLED':
    case 'PRICE_MISMATCH':
    case 'NOT_AN_INVOICE':
      return {
        variant: 'danger',
        label: status === 'MISMATCH' ? 'Mismatch / Exception' : status === 'OVERBILLED' ? 'Overbilled' : status === 'PRICE_MISMATCH' ? 'Price Discrepancy' : 'Failed',
        dot: true,
      };

    case 'PROCESSING':
    case 'QUEUED':
      return { variant: 'brand', label: status === 'PROCESSING' ? 'Processing…' : 'Queued', dot: true };

    case 'INVOICE_CANDIDATE':
      return { variant: 'info', label: 'Invoice Candidate', dot: true };

    case 'DRAFT':
      return { variant: 'default', label: 'Draft', dot: false };

    case 'CLOSED':
      return { variant: 'default', label: 'Closed', dot: false };

    case 'CANCELLED':
      return { variant: 'danger', label: 'Cancelled', dot: false };

    case 'UPLOADED':
    case 'PENDING':
    default:
      return { variant: 'default', label: status || 'Pending', dot: false };
  }
}
