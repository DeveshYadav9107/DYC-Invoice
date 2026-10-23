// ─────────────────────────────────────────────────────────────────
// Admin Users Page — Global user directory & role management
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../utils/helpers';
import Icon from '../../components/ui/Icon';
import api from '../../api/client';
import { Loader2 } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const data = await api.get('/api/admin/users');
        setUsers(data.users || []);
      } catch (err) {
        console.error('Failed to load admin users:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm text-gray-500">Loading user directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin"
          className="p-2 rounded-xl text-gray-500 hover:text-navy-900 hover:bg-gray-100 transition-colors"
        >
          <Icon name="ChevronLeft" className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Registered accounts across all tenant organizations.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-navy-900">All Registered Users ({users.length})</h3>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-6">Name</th>
                <th className="py-3 px-6">Email</th>
                <th className="py-3 px-6">Organization</th>
                <th className="py-3 px-6">Role</th>
                <th className="py-3 px-6 text-right">Invoices Uploaded</th>
                <th className="py-3 px-6">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-6 font-medium text-navy-900">{u.name || 'Unnamed'}</td>
                  <td className="py-3.5 px-6 text-gray-600 font-mono text-xs">{u.email}</td>
                  <td className="py-3.5 px-6 text-gray-700">{u.organization?.name || <span className="text-gray-400 italic">None</span>}</td>
                  <td className="py-3.5 px-6">
                    <Badge variant={u.role === 'ADMIN' ? 'brand' : 'default'} size="sm">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-6 text-right font-medium text-navy-900">
                    {u._count?.uploadedInvoices || 0}
                  </td>
                  <td className="py-3.5 px-6 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
