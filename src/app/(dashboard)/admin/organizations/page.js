// ─────────────────────────────────────────────────────────────────
// Admin Organizations Page — Multi-tenant tenant accounts
// ─────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import Icon from '@/components/ui/Icon';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Organizations — InvoiceFlow Admin',
};

export default async function AdminOrganizationsPage() {
  const adminResult = await requireAdmin();
  if (!adminResult) {
    redirect('/dashboard');
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { users: true, invoices: true, exportBatches: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="p-2 rounded-xl text-gray-500 hover:text-navy-900 hover:bg-gray-100 transition-colors"
        >
          <Icon name="ChevronLeft" className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Multi-tenant workspaces and isolation boundaries.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-navy-900">
            Tenant Workspaces ({organizations.length})
          </h3>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-6">Organization</th>
                <th className="py-3 px-6">Slug</th>
                <th className="py-3 px-6 text-right">Users</th>
                <th className="py-3 px-6 text-right">Invoices</th>
                <th className="py-3 px-6 text-right">Exports</th>
                <th className="py-3 px-6">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-6 font-semibold text-navy-900">{org.name}</td>
                  <td className="py-3.5 px-6 font-mono text-xs text-gray-500">{org.slug}</td>
                  <td className="py-3.5 px-6 text-right text-gray-700">{org._count.users}</td>
                  <td className="py-3.5 px-6 text-right text-gray-700">{org._count.invoices}</td>
                  <td className="py-3.5 px-6 text-right text-gray-700">{org._count.exportBatches}</td>
                  <td className="py-3.5 px-6 text-xs text-gray-400">{formatDate(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
