// ─────────────────────────────────────────────────────────────────
// Button Component — Interactive buttons with animations & loading
// ─────────────────────────────────────────────────────────────────

import React from 'react';
import { Loader2 } from 'lucide-react';
import Icon from './Icon.jsx';
import { cn } from '../../utils/helpers.js';

const variantClasses = {
  primary:
    'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white shadow-sm hover:shadow active:scale-[0.98]',
  secondary:
    'bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.98]',
  outline:
    'border border-brand-500/30 text-brand-700 hover:bg-brand-50/50 hover:border-brand-500 active:scale-[0.98]',
  ghost:
    'text-navy-700 hover:bg-gray-100/80 active:bg-gray-200/60',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-sm active:scale-[0.98]',
};

const sizeClasses = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-5 py-3 rounded-xl gap-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) {
  const renderIcon = () => {
    if (loading) return <Loader2 className="w-4 h-4 animate-spin text-current" />;
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'string') {
      return <Icon name={icon} className="w-4 h-4 flex-shrink-0" />;
    }
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
    ) {
      const IconComponent = icon;
      return <IconComponent className="w-4 h-4 flex-shrink-0" />;
    }
    return null;
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer select-none',
        'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none',
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      {...props}
    >
      {renderIcon()}
      {children}
    </button>
  );
}
