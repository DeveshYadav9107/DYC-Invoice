// ─────────────────────────────────────────────────────────────────
// Settings Page — User profile & personal account details
// (Organization Profile card removed per user preference)
// ─────────────────────────────────────────────────────────────────

import { requireSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import EditSettingsModal from '@/components/settings/EditSettingsModal';
import { formatDate } from '@/lib/utils';

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
  const isAdmin = user.role === 'ADMIN';

  // Fetch full user details from DB
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      designation: true,
      role: true,
      createdAt: true,
    },
  });

  const currentUser = dbUser || user;

  // Check integration states from process.env (for admin overview)
  const integrations = [
    {
      name: 'PostgreSQL Database',
      service: 'Neon Serverless',
      configured: Boolean(process.env.DATABASE_URL),
      iconName: 'Database',
      details: process.env.DATABASE_URL ? 'Connected to Neon pooler' : 'Missing DATABASE_URL',
    },
    {
      name: 'Azure AI Document Intelligence',
      service: 'Prebuilt Invoice OCR',
      configured: Boolean(process.env.DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.DOCUMENT_INTELLIGENCE_KEY),
      iconName: 'Cpu',
      details: process.env.DOCUMENT_INTELLIGENCE_ENDPOINT
        ? 'Endpoint active'
        : 'Set DOCUMENT_INTELLIGENCE_KEY in .env.local',
    },
    {
      name: 'Azure Blob Storage',
      service: 'Private container "invoices"',
      configured: Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING),
      iconName: 'Cloud',
      details: process.env.AZURE_STORAGE_CONNECTION_STRING
        ? 'Connected to Azure container'
        : 'Running on local dev storage (.storage/invoices/)',
    },
    {
      name: 'SMTP Email Delivery',
      service: 'Passwordless OTP Delivery',
      configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      iconName: 'Mail',
      details: process.env.SMTP_HOST
        ? `Configured via ${process.env.SMTP_HOST}`
        : 'Dev Mode active (codes logged to server console)',
    },
  ];

  const serializedUser = {
    id: currentUser.id,
    name: currentUser.name || '',
    email: currentUser.email || '',
    phoneNumber: currentUser.phoneNumber || '',
    dateOfBirth: currentUser.dateOfBirth ? currentUser.dateOfBirth.toISOString().slice(0, 10) : '',
    gender: currentUser.gender || '',
    address: currentUser.address || '',
    designation: currentUser.designation || '',
    role: currentUser.role,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            Settings & Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your personal profile details, contact information, and security preferences.
          </p>
        </div>

        <EditSettingsModal user={serializedUser} />
      </div>

      {/* ─── User Profile Card ─────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="User" className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-semibold text-navy-900">User Account & Profile</h3>
          </div>
          <EditSettingsModal user={serializedUser} variant="icon" size="sm" />
        </CardHeader>
        <CardBody className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Full Name</span>
              <p className="text-base font-medium text-navy-900 mt-1">{currentUser.name || 'User'}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Email Address</span>
              <p className="text-sm text-navy-900 mt-1">{currentUser.email}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Phone Number</span>
              <p className="text-sm text-navy-900 mt-1">{currentUser.phoneNumber || <span className="text-gray-400 italic">Not provided</span>}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Date of Birth</span>
              <p className="text-sm text-navy-900 mt-1">
                {currentUser.dateOfBirth ? formatDate(currentUser.dateOfBirth) : <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Gender</span>
              <p className="text-sm text-navy-900 mt-1">
                {currentUser.gender || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Designation / Title</span>
              <p className="text-sm text-navy-900 mt-1">
                {currentUser.designation || <span className="text-gray-400 italic">Member</span>}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-gray-400">City / Address</span>
              <p className="text-sm text-navy-900 mt-1">
                {currentUser.address || <span className="text-gray-400 italic">Not provided</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Account Role</span>
              <div className="mt-1">
                <Badge variant={currentUser.role === 'ADMIN' ? 'brand' : 'success'} size="sm">
                  {currentUser.role}
                </Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── Cloud Infrastructure Connections (Admin Only) ─────── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon name="Shield" className="w-4 h-4 text-brand-600" />
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
                    <Icon name={item.iconName} className="w-5 h-5" />
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
      )}
    </div>
  );
}
