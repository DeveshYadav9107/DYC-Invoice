// ─────────────────────────────────────────────────────────────────
// Settings Page — Organization, profile & integration statuses
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import {
  Building2,
  User,
  Shield,
  Database,
  Cloud,
  Mail,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Settings — InvoiceFlow',
};

export default async function SettingsPage() {
  const sessionData = await requireSession();
  if (!sessionData || !sessionData.user) {
    return null;
  }
  const user = sessionData.user;

  let memberCount = 1;
  let organization = user.organization;

  if (user.organizationId) {
    const orgWithUsers = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        _count: { select: { users: true, invoices: true } },
      },
    });
    if (orgWithUsers) {
      organization = orgWithUsers;
      memberCount = orgWithUsers._count.users;
    }
  }

  // Check integration states from process.env
  const integrations = [
    {
      name: 'PostgreSQL Database',
      service: 'Neon Serverless',
      configured: Boolean(process.env.DATABASE_URL),
      icon: Database,
      details: process.env.DATABASE_URL ? 'Connected to Neon pooler' : 'Missing DATABASE_URL',
    },
    {
      name: 'Azure AI Document Intelligence',
      service: 'Prebuilt Invoice OCR',
      configured: Boolean(process.env.DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.DOCUMENT_INTELLIGENCE_KEY),
      icon: Cpu,
      details: process.env.DOCUMENT_INTELLIGENCE_ENDPOINT
        ? 'Endpoint active'
        : 'Set DOCUMENT_INTELLIGENCE_KEY in .env.local',
    },
    {
      name: 'Azure Blob Storage',
      service: 'Private container "invoices"',
      configured: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING),
      icon: Cloud,
      details: process.env.AZURE_STORAGE_CONNECTION_STRING
        ? 'Connected to Azure container'
        : 'Running on local dev storage (.storage/invoices/)',
    },
    {
      name: 'SMTP Email Delivery',
      service: 'Passwordless OTP Delivery',
      configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      icon: Mail,
      details: process.env.SMTP_HOST
        ? `Configured via ${process.env.SMTP_HOST}`
        : 'Dev Mode active (codes logged to server console)',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
          Settings & Integrations
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your organization profile, security, and cloud infrastructure connections.
        </p>
      </div>

      {/* ─── Organization Information ──────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-semibold text-navy-900">Organization Profile</h3>
          </div>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Organization Name</span>
              <p className="text-base font-medium text-navy-900 mt-1">
                {organization?.name || 'Personal Workspace'}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Slug Identifier</span>
              <p className="text-sm font-mono text-gray-600 mt-1">
                {organization?.slug || 'personal'}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Total Members</span>
              <p className="text-sm font-medium text-navy-900 mt-1">
                {memberCount} active member{memberCount === 1 ? '' : 's'}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Created Date</span>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(organization?.createdAt || new Date())}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── User Profile ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-semibold text-navy-900">User Account</h3>
          </div>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Full Name</span>
              <p className="text-base font-medium text-navy-900 mt-1">{user.name || 'User'}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Email Address</span>
              <p className="text-sm text-navy-900 mt-1">{user.email}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Account Role</span>
              <div className="mt-1">
                <Badge variant={user.role === 'ADMIN' ? 'brand' : 'success'} size="sm">
                  {user.role}
                </Badge>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Authentication</span>
              <p className="text-sm text-gray-600 mt-1">Passwordless OTP (Email Verified)</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── Cloud Infrastructure Connections ──────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-semibold text-navy-900">Connected Services & Infrastructure</h3>
          </div>
        </CardHeader>
        <CardBody className="p-0 divide-y divide-gray-100">
          {integrations.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-5 hover:bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.configured
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-navy-900">{item.name}</h4>
                  <p className="text-xs text-gray-500">{item.details}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.configured ? (
                  <Badge variant="success" size="sm" dot>
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    Pending Config
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
