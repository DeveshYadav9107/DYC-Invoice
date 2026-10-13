'use client';

// ─────────────────────────────────────────────────────────────────
// EmptyState Component — Engaging zero-data state displays
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { cn } from '@/lib/utils';
import Button from './Button';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50',
        className
      )}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-navy-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <Button icon={actionIcon}>{actionLabel}</Button>
          </Link>
        ) : (
          <Button onClick={onAction} icon={actionIcon}>{actionLabel}</Button>
        )
      )}
    </div>
  );
}
