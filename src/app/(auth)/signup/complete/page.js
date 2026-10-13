'use client';

// ─────────────────────────────────────────────────────────────────
// Complete Signup — Profile completion after OTP verification
// Only shown to new users who haven't set up their name/org yet
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Building2,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function CompleteSignupPage() {
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!organizationName.trim()) {
      setError('Please enter your company or organization name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          organizationName: organizationName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to complete signup.');
        return;
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-geometric p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg">
            <FileCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-navy-900 tracking-tight">InvoiceFlow</span>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl shadow-elevated border border-gray-100 p-8 sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-navy-900">Complete your profile</h2>
            <p className="mt-2 text-sm text-gray-500">
              Tell us a bit about yourself to set up your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-navy-700 mb-2">
                Your name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="John Doe"
                  className="input-field pl-11"
                  required
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Organization */}
            <div>
              <label htmlFor="org" className="block text-sm font-medium text-navy-700 mb-2">
                Company / Organization
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="org"
                  type="text"
                  value={organizationName}
                  onChange={(e) => { setOrganizationName(e.target.value); setError(''); }}
                  placeholder="Acme Corp"
                  className="input-field pl-11"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim() || !organizationName.trim()}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up account...
                </>
              ) : (
                <>
                  Get started
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          A new organization will be created for you as the account owner.
        </p>
      </motion.div>
    </div>
  );
}
