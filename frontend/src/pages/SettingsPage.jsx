// ─────────────────────────────────────────────────────────────────
// Settings Page — User profile & personal account details
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import EditSettingsModal from '../components/settings/EditSettingsModal';
import { formatDate } from '../utils/helpers';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const [currentUser, setCurrentUser] = useState(authUser);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await api.get('/api/settings');
        if (data?.user) {
          setCurrentUser(data.user);
        }
        if (data?.integrations) {
          setIntegrations(data.integrations);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUserUpdated = (updated) => {
    setCurrentUser(updated);
    setAuthUser((prev) => ({ ...prev, ...updated }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-gray-500">Loading profile and configurations...</p>
      </div>
    );
  }

  const user = currentUser || authUser || {};

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

        <EditSettingsModal user={user} onUpdated={handleUserUpdated} />
      </div>

      {/* ─── User Profile Card ─────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="User" className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-semibold text-navy-900">User Account & Profile</h3>
          </div>
          <EditSettingsModal user={user} variant="icon" size="sm" onUpdated={handleUserUpdated} />
        </CardHeader>
        <CardBody className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Full Name</span>
              <p className="text-base font-medium text-navy-900 mt-1">{user.name || 'User'}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Email Address</span>
              <p className="text-sm text-navy-900 mt-1">{user.email}</p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Phone Number</span>
              <p className="text-sm text-navy-900 mt-1">
                {user.phoneNumber || <span className="text-gray-400 italic">Not provided</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Date of Birth</span>
              <p className="text-sm text-navy-900 mt-1">
                {user.dateOfBirth ? formatDate(user.dateOfBirth) : <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Gender</span>
              <p className="text-sm text-navy-900 mt-1">
                {user.gender || <span className="text-gray-400 italic">Not specified</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Designation / Title</span>
              <p className="text-sm text-navy-900 mt-1">
                {user.designation || <span className="text-gray-400 italic">Member</span>}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase text-gray-400">Address / Location</span>
              <p className="text-sm text-navy-900 mt-1">
                {user.address || <span className="text-gray-400 italic">Not provided</span>}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Role & Permissions</span>
              <div className="mt-1">
                <Badge variant={user.role === 'ADMIN' ? 'brand' : 'default'} size="sm">
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ─── Connected Services (Integrations) ─────────────────── */}
      {integrations && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold text-navy-900">Connected Services & Infrastructure</h3>
            <p className="text-xs text-gray-500 mt-0.5">Underlying cloud, database, and extraction services</p>
          </CardHeader>
          <CardBody className="p-0 divide-y divide-gray-100">
            {integrations.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-5 hover:bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                    <Icon name={svc.iconName} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-navy-900">{svc.name}</h4>
                    <p className="text-xs text-gray-500">{svc.details}</p>
                  </div>
                </div>
                <Badge variant={svc.configured ? 'success' : 'warning'} size="sm">
                  {svc.configured ? 'Active' : 'Unconfigured'}
                </Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
