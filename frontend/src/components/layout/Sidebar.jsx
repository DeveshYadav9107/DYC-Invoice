// ─────────────────────────────────────────────────────────────────
// Sidebar — Main navigation for authenticated users
// Adapts based on user role (ADMIN vs CLIENT)
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileCheck,
  LayoutDashboard,
  FileText,
  Upload,
  Download,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Shield,
  Building2,
  Package,
  ClipboardList,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Sidebar navigation items configuration.
 * Items with `adminOnly: true` are only visible to ADMIN users.
 */
const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: FileText,
  },
  {
    label: 'Upload',
    href: '/invoices/upload',
    icon: Upload,
  },
  {
    label: 'Exports',
    href: '/exports',
    icon: Download,
  },
];

const adminItems = [
  {
    label: 'Overview',
    href: '/admin',
    icon: Shield,
    adminOnly: true,
  },
  {
    label: 'Vendors',
    href: '/admin/vendors',
    icon: Building2,
    adminOnly: true,
  },
  {
    label: 'Items & SKU',
    href: '/admin/items',
    icon: Package,
    adminOnly: true,
  },
  {
    label: 'Purchase Orders',
    href: '/admin/purchase-orders',
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    label: 'Goods Receipts',
    href: '/admin/goods-receipts',
    icon: PackageCheck,
    adminOnly: true,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    adminOnly: true,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    adminOnly: true,
  },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const renderNavLink = (item) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     transition-all duration-200 group
                     ${active
                       ? 'bg-brand-50 text-brand-700 font-semibold shadow-sm'
                       : 'text-navy-500 hover:bg-gray-100 hover:text-navy-700'
                     }
                     ${collapsed && !mobileOpen ? 'justify-center' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className={`w-[18px] h-[18px] flex-shrink-0
                               ${active ? 'text-brand-600' : 'text-gray-400 group-hover:text-navy-600'}`} />
        {(!collapsed || mobileOpen) && (
          <motion.span
            initial={false}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="truncate"
          >
            {item.label}
          </motion.span>
        )}
        {active && (!collapsed || mobileOpen) && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
        )}
      </Link>
    );
  };

  // For Admin: Settings is located under Administration section
  // For Client: Settings is located in Main navigation so clients can also modify their details
  const currentNavItems = isAdmin
    ? navItems
    : [
        ...navItems,
        {
          label: 'Settings',
          href: '/settings',
          icon: Settings,
        },
      ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + Collapse */}
      <div className={`flex items-center ${collapsed && !mobileOpen ? 'justify-center' : 'justify-between'} px-4 py-5 border-b border-gray-100`}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <FileCheck className="w-4 h-4 text-white" />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="text-lg font-bold text-navy-900 tracking-tight">InvoiceFlow</span>
          )}
        </Link>
        {(!collapsed || mobileOpen) && (
          <button
            onClick={() => mobileOpen ? setMobileOpen(false) : setCollapsed(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-navy-700 hover:bg-gray-100 transition-colors hidden lg:flex"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {/* Main nav */}
        <div className="space-y-1">
          {(!collapsed || mobileOpen) && (
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Main
            </p>
          )}
          {currentNavItems.map(renderNavLink)}
        </div>

        {/* Admin nav */}
        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-1">
            {(!collapsed || mobileOpen) && (
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Administration
              </p>
            )}
            {adminItems.map(renderNavLink)}
          </div>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-100 px-3 py-4">
        {(!collapsed || mobileOpen) && user && (
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-navy-800 truncate">{user.name || 'User'}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold uppercase tracking-wider
                              ${isAdmin ? 'text-brand-600' : 'text-success-600'}`}>
              {isAdmin ? <Shield className="w-3 h-3" /> : null}
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                       text-sm font-medium text-gray-500
                       hover:bg-danger-50 hover:text-danger-600
                       transition-all duration-200
                       ${collapsed && !mobileOpen ? 'justify-center' : ''}`}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Mobile trigger ────────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white shadow-card
                   text-navy-700 hover:bg-gray-50 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ─── Mobile overlay ────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white border-r border-gray-100 shadow-elevated"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-navy-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Desktop sidebar ───────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="hidden lg:flex flex-col h-screen bg-white border-r border-gray-100 sticky top-0 overflow-hidden"
      >
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-3 p-1.5 rounded-lg text-gray-400 hover:text-navy-700 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        {sidebarContent}
      </motion.aside>
    </>
  );
}
