// ─────────────────────────────────────────────────────────────────
// EmptyState Component — Zero-data display
// ─────────────────────────────────────────────────────────────────

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/helpers.js';
import Button from './Button.jsx';
import Icon from './Icon.jsx';

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  actionIcon,
  className = '',
}) {
  const renderMainIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'string') {
      return <Icon name={icon} className="w-7 h-7" />;
    }
    if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
    ) {
      const IconComponent = icon;
      return <IconComponent className="w-7 h-7" />;
    }
    return null;
  };

  const renderActionIcon = () => {
    if (!actionIcon) return null;
    if (React.isValidElement(actionIcon)) return actionIcon;
    if (typeof actionIcon === 'string') {
      return <Icon name={actionIcon} className="w-4 h-4" />;
    }
    if (
      typeof actionIcon === 'function' ||
      (typeof actionIcon === 'object' && actionIcon !== null && ('render' in actionIcon || '$$typeof' in actionIcon))
    ) {
      const ActionIconComponent = actionIcon;
      return <ActionIconComponent className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-10 sm:p-14 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50',
        className
      )}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 border border-brand-200/60 flex items-center justify-center text-brand-600 mb-5 shadow-sm">
          {renderMainIcon()}
        </div>
      )}
      <h3 className="text-lg font-semibold text-navy-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && (
        actionHref ? (
          <Link to={actionHref}>
            <Button>
              {renderActionIcon()}
              {actionLabel}
            </Button>
          </Link>
        ) : (
          <Button onClick={onAction}>
            {renderActionIcon()}
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
