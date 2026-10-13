// ─────────────────────────────────────────────────────────────────
// Card Component — Glassmorphic & elevated dashboard surfaces
// ─────────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils';

export default function Card({
  children,
  className = '',
  hover = false,
  glass = false,
  ...props
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-100 bg-white shadow-card transition-all duration-200',
        hover && 'hover:shadow-card-hover hover:border-gray-200 hover:-translate-y-0.5',
        glass && 'bg-white/80 backdrop-blur-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={cn('px-6 py-5 border-b border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={cn('px-6 py-4 bg-gray-50/50 border-t border-gray-100 rounded-b-2xl', className)} {...props}>
      {children}
    </div>
  );
}
