'use client';

// ─────────────────────────────────────────────────────────────────
// EditSettingsModal — Modal to allow users to edit profile:
// Name, Date of Birth, Gender, Designation, Phone, Address, and Password
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import {
  Pencil,
  X,
  Check,
  Lock,
  User,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  AlertCircle,
} from 'lucide-react';

export default function EditSettingsModal({ user, variant = 'default', size = 'md' }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phoneNumber: user?.phoneNumber || '',
    dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
    gender: user?.gender || '',
    designation: user?.designation || '',
    address: user?.address || '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpen = () => {
    setError(null);
    setSuccess(false);
    setFormData({
      name: user?.name || '',
      phoneNumber: user?.phoneNumber || '',
      dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '',
      gender: user?.gender || '',
      designation: user?.designation || '',
      address: user?.address || '',
      password: '',
      confirmPassword: '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Full name cannot be empty.');
      return;
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        designation: formData.designation.trim() || null,
        address: formData.address.trim() || null,
      };

      if (formData.password) {
        payload.password = formData.password;
        payload.confirmPassword = formData.confirmPassword;
      }

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update profile.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        router.refresh();
      }, 1000);
    } catch {
      setError('Network error while updating profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant === 'icon' ? 'ghost' : 'secondary'}
        size={size}
        onClick={handleOpen}
        className={variant === 'icon' ? 'p-1.5 text-gray-500 hover:text-brand-600' : ''}
        title="Edit Profile"
      >
        <Pencil className="w-4 h-4 mr-1.5 text-brand-600" />
        {variant !== 'icon' && 'Edit Profile'}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-elevated border border-gray-100 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-navy-900">Edit Profile Details</h3>
                  <p className="text-xs text-gray-500">Update personal information, DOB, contact, and security</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-navy-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {/* Grid: Full Name & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. John Doe"
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Designation / Title
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      placeholder="e.g. Finance Manager"
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                    />
                  </div>
                </div>
              </div>

              {/* Grid: Date of Birth & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900 bg-white"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Grid: Phone Number & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876543210"
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                    City / Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="e.g. Delhi, India"
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                    />
                  </div>
                </div>
              </div>

              {/* Change Password (Optional) */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Change Password (Leave blank to keep unchanged)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="New password (min 6)"
                        className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm password"
                        disabled={!formData.password}
                        className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all text-navy-900 disabled:bg-gray-50 disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={loading || success}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
