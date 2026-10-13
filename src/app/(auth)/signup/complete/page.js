'use client';

// ─────────────────────────────────────────────────────────────────
// Complete Signup — Obsoleted in favor of unified signup flow
// Automatically redirects users directly to dashboard
// ─────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompleteSignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-sm text-gray-500">Redirecting to dashboard...</div>
    </div>
  );
}
