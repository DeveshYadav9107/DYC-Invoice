'use client';

// ─────────────────────────────────────────────────────────────────
// DashboardShell — Responsive container with Sidebar, TopNav & Content
// ─────────────────────────────────────────────────────────────────

import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function DashboardShell({ user, children }) {
  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav user={user} />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
