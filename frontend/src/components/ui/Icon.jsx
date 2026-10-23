// ─────────────────────────────────────────────────────────────────
// Icon Component — Lucide icon renderer
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
  Pencil,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Check,
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
  Pencil,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Check,
};

export default function Icon({ name, className = 'w-5 h-5' }) {
  if (!name) return null;

  if (React.isValidElement(name)) {
    return name;
  }

  if (
    typeof name === 'function' ||
    (typeof name === 'object' && name !== null && ('render' in name || '$$typeof' in name))
  ) {
    const IconComponent = name;
    return <IconComponent className={className} />;
  }

  if (typeof name === 'string') {
    const IconComponent = iconMap[name];
    if (IconComponent) {
      return <IconComponent className={className} />;
    }
  }

  return null;
}

export { iconMap };
