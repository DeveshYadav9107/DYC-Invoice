'use client';

// ─────────────────────────────────────────────────────────────────
// Icon Component — Client-side Lucide icon renderer
// Allows server components to pass icon names as strings
// ─────────────────────────────────────────────────────────────────

import React from 'react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Clock,
  Search,
  Filter,
  ExternalLink,
  AlertCircle,
  FileSpreadsheet,
  Shield,
  Users,
  Building2,
  Activity,
  FileCheck,
  ChevronLeft,
  Database,
  Cloud,
  Mail,
  Cpu,
  User,
  BarChart3,
  Settings,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Loader2,
  ShieldCheck,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

const iconMap = {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Clock,
  Search,
  Filter,
  ExternalLink,
  AlertCircle,
  FileSpreadsheet,
  Shield,
  Users,
  Building2,
  Activity,
  FileCheck,
  ChevronLeft,
  Database,
  Cloud,
  Mail,
  Cpu,
  User,
  BarChart3,
  Settings,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Loader2,
  ShieldCheck,
  RefreshCw,
  ShieldAlert,
};

/**
 * Renders a Lucide icon by name (string) or by component reference.
 * This component is 'use client' so it can be used from server components
 * by passing the icon name as a string prop.
 * 
 * @param {string|Function|object} name - Icon name (string) or icon component
 * @param {string} className - CSS classes for the icon
 */
export default function Icon({ name, className = 'w-5 h-5' }) {
  if (!name) return null;
  
  if (React.isValidElement(name)) {
    return name;
  }

  // If a component reference is passed (function or forwardRef object)
  if (
    typeof name === 'function' ||
    (typeof name === 'object' && name !== null && ('render' in name || '$$typeof' in name))
  ) {
    const IconComponent = name;
    return <IconComponent className={className} />;
  }
  
  // Look up icon by string name
  if (typeof name === 'string') {
    const IconComponent = iconMap[name];
    if (IconComponent) {
      return <IconComponent className={className} />;
    }
  }

  return null;
}

/**
 * Export the icon map for cases where components need to render icons dynamically
 */
export { iconMap };
