// ─────────────────────────────────────────────────────────────────
// Top Navigation Bar — Shows on dashboard pages
// Displays page title and user quick profile (Search & Notifications removed)
// ─────────────────────────────────────────────────────────────────

import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Generates a human-readable page title from the current path.
 */
function getPageTitle(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const titles = {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    upload: 'Upload Invoices',
    exports: 'Export History',
    settings: 'Settings',
    admin: 'Administration',
    users: 'User Management',
    organizations: 'Organizations',
  };

  // Use the last meaningful segment
  const lastSegment = segments[segments.length - 1];
  return titles[lastSegment] || 'InvoiceFlow';
}

export default function TopNav() {
  const { user } = useAuth();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 lg:px-8 h-16">
        {/* Left — Page title */}
        <div className="flex items-center gap-4 pl-12 lg:pl-0">
          <h1 className="text-lg font-semibold text-navy-900">{pageTitle}</h1>
        </div>

        {/* Right — User avatar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                            flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-navy-800 leading-tight">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-gray-400 leading-tight">
                {user?.role === 'ADMIN' ? 'Administrator' : 'Member'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
