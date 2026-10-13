// ─────────────────────────────────────────────────────────────────
// Dashboard Layout — Wraps all authenticated pages
// Server component that checks session and renders sidebar + topnav
// ─────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import DashboardShell from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }) {
  // Server-side session check — redirects if not authenticated
  const result = await getSession();

  if (!result) {
    redirect('/login');
  }

  const { user } = result;

  // If user hasn't completed their profile (no name), redirect to complete signup
  if (!user.name && user.role !== 'ADMIN') {
    redirect('/signup/complete');
  }

  // Serialize user data for client components
  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization?.name || null,
  };

  return <DashboardShell user={serializedUser}>{children}</DashboardShell>;
}
