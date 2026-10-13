// ─────────────────────────────────────────────────────────────────
// Admin Overview Page — System-wide telemetry & administration
// Role-protected: only ADMIN users can access
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administration — InvoiceFlow',
};

export default async function AdminPage() {
  const adminResult = await requireAdmin();
  if (!adminResult) {
    redirect('/dashboard');
  }

  const [totalUsers, totalOrgs, totalInvoices, totalExports, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.invoice.count(),
    prisma.exportBatch.count(),
    prisma.user.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { organization: true },
    }),
  ]);

  const cards = [
    { title: 'Total Users', value: totalUsers, iconName: 'Users', href: '/admin/users' },
    { title: 'System Invoices', value: totalInvoices, iconName: 'FileText', href: '/invoices' },
    { title: 'CSV Exports', value: totalExports, iconName: 'Download', href: '/exports' },
    { title: 'System Settings', value: 'Config', iconName: 'Settings', href: '/settings' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold mb-2">
            <Icon name="Shield" className="w-3.5 h-3.5" />
            Superadmin Controls
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            System Administration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Global user directory, organization multi-tenant accounts, exports, and operational telemetry.
          </p>
        </div>

        <Link href="/exports">
          <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-navy-800 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all">
            <Icon name="Download" className="w-4 h-4 text-brand-600" />
            Manage Exports
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card hover className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {card.title}
                </span>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon name={card.iconName} className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-navy-900 mt-3">{card.value}</p>
              <div className="flex items-center gap-1 text-xs font-semibold text-brand-600 mt-2">
                Manage
                <Icon name="ArrowRight" className="w-3 h-3" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="text-base font-semibold text-navy-900">Recently Registered Users</h3>
          <Link href="/admin/users" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-6">User</th>
                <th className="py-3 px-6">Email</th>
                <th className="py-3 px-6">Organization</th>
                <th className="py-3 px-6">Role</th>
                <th className="py-3 px-6">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-6 font-medium text-navy-900">{u.name || 'Unnamed'}</td>
                  <td className="py-3.5 px-6 text-gray-600">{u.email}</td>
                  <td className="py-3.5 px-6 text-gray-600">{u.organization?.name || 'None'}</td>
                  <td className="py-3.5 px-6">
                    <Badge variant={u.role === 'ADMIN' ? 'brand' : 'default'} size="sm">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-6 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
