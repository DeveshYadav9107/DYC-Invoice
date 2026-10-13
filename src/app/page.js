// ─────────────────────────────────────────────────────────────────
// Root Page — Redirects to /login or /dashboard based on auth state
// ─────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await getSession();

  if (result?.user) {
    redirect('/dashboard');
  }

  redirect('/login');
}
