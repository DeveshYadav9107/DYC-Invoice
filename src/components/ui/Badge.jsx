// ─────────────────────────────────────────────────────────────────
// Badge Component — Status and category indicators
// ─────────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils';

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

/**
 * Helper to get badge style configuration from a ValidationStatus or ProcessingStatus enum value
 */
export function getStatusBadgeProps(status) {
  switch (status) {
    case 'VALIDATED':
    case 'COMPLETED':
      return { variant: 'success', label: status === 'VALIDATED' ? 'Validated' : 'Completed', dot: true };
    case 'NEEDS_REVIEW':
    case 'UNCERTAIN':
      return { variant: 'warning', label: status === 'NEEDS_REVIEW' ? 'Needs Review' : 'Uncertain', dot: true };
    case 'REJECTED':
    case 'FAILED':
    case 'NOT_AN_INVOICE':
      return {
        variant: 'danger',
        label: status === 'NOT_AN_INVOICE' ? 'Not an Invoice' : status === 'REJECTED' ? 'Rejected' : 'Failed',
        dot: false,
      };
    case 'PROCESSING':
    case 'QUEUED':
      return { variant: 'brand', label: status === 'PROCESSING' ? 'Processing…' : 'Queued', dot: true };
    case 'INVOICE_CANDIDATE':
      return { variant: 'info', label: 'Invoice Candidate', dot: true };
    case 'UPLOADED':
    case 'PENDING':
    default:
      return { variant: 'default', label: status || 'Pending', dot: false };
  }
}
