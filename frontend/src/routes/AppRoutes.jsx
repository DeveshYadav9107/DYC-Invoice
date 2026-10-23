// ─────────────────────────────────────────────────────────────────
// AppRoutes — Application Route Hierarchy with Protected & Admin Guards
// ─────────────────────────────────────────────────────────────────

import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardShell from '../components/layout/DashboardShell';
import AuthPage from '../pages/AuthPage';
import DashboardPage from '../pages/DashboardPage';
import InvoicesPage from '../pages/InvoicesPage';
import InvoiceUploadPage from '../pages/InvoiceUploadPage';
import InvoiceDetailPage from '../pages/InvoiceDetailPage';
import ExportsPage from '../pages/ExportsPage';
import SettingsPage from '../pages/SettingsPage';
import AdminOverviewPage from '../pages/admin/AdminOverviewPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminOrganizationsPage from '../pages/admin/AdminOrganizationsPage';
import { Loader2 } from 'lucide-react';

function FullPageLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50/50">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg mb-4">
        <Loader2 className="w-5 h-5 text-white animate-spin" />
      </div>
      <p className="text-sm font-medium text-navy-800">Loading InvoiceFlow...</p>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function PublicRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <FullPageLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
      </Route>

      {/* Authenticated Dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/upload" element={<InvoiceUploadPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Admin routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/organizations" element={<AdminOrganizationsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
