'use client';

// ─────────────────────────────────────────────────────────────────
// Login Page — Beautiful split-screen OTP authentication
// First screen every unauthenticated user sees
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  BarChart3,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// Steps in the auth flow
const STEPS = {
  EMAIL: 'email',
  OTP: 'otp',
  SUCCESS: 'success',
};

export default function LoginPage() {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef([]);
  const emailInputRef = useRef(null);

  // Focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ─── Step 1: Request OTP ────────────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send verification code.');
        return;
      }

      setSuccess('Verification code sent! Check your email.');
      setStep(STEPS.OTP);
      setResendCooldown(60);

      // Focus first OTP input after transition
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Handle OTP input ───────────────────────────────
  const handleOtpChange = useCallback((index, value) => {
    // Allow only digits
    const digit = value.replace(/\D/g, '').slice(-1);

    setOtp((prev) => {
      const newOtp = [...prev];
      newOtp[index] = digit;
      return newOtp;
    });

    // Auto-focus next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  // Handle paste for OTP
  const handleOtpPaste = useCallback((e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length && i < 6; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex((d) => !d);
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    otpRefs.current[focusIndex]?.focus();
  }, [otp]);

  // ─── Step 3: Verify OTP ────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid verification code.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }

      setStep(STEPS.SUCCESS);
      setSuccess('Verified successfully! Redirecting...');

      // Redirect based on whether user needs to complete profile
      setTimeout(() => {
        if (data.needsProfile) {
          window.location.href = '/signup/complete';
        } else {
          window.location.href = '/dashboard';
        }
      }, 1000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ─────────────────────────────────────────────
  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend code.');
        return;
      }

      setSuccess('New verification code sent!');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Feature cards ──────────────────────────────────────────
  const features = [
    {
      icon: FileCheck,
      title: 'AI Extraction',
      desc: 'Intelligent document processing powered by Azure AI',
      gradient: 'from-brand-500 to-brand-600',
    },
    {
      icon: ShieldCheck,
      title: 'Smart Validation',
      desc: 'Automatic verification with configurable business rules',
      gradient: 'from-success-500 to-success-600',
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      desc: 'Track processing activity and validation metrics',
      gradient: 'from-warning-500 to-warning-600',
    },
    {
      icon: Download,
      title: 'CSV Export',
      desc: 'Download validated invoices in clean, spreadsheet-ready format',
      gradient: 'from-brand-600 to-brand-800',
    },
  ];

  return (
    <div className="min-h-screen flex bg-geometric">
      {/* ─── Left Panel — Branding ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-brand-950" />

        {/* Geometric accents */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-400 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-success-500 rounded-full blur-3xl" />
        </div>

        {/* Polygon SVG decoration */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 30 52 L 0 0 Z" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">InvoiceFlow</span>
            </div>
          </motion.div>

          {/* Hero text */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                AI-Powered Invoice
                <br />
                <span className="bg-gradient-to-r from-brand-300 to-brand-400 bg-clip-text text-transparent">
                  Verification & Export
                </span>
              </h1>
              <p className="mt-5 text-lg text-navy-300 max-w-lg leading-relaxed">
                Upload invoices, let AI extract and verify the data, review
                discrepancies, and download clean CSV exports — all in one
                streamlined workflow.
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="group p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm
                             hover:bg-white/10 transition-all duration-300 cursor-default"
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${feature.gradient}
                                   flex items-center justify-center mb-3
                                   shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-navy-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-xs text-navy-500"
          >
            Secure. Private. Enterprise-grade document processing.
          </motion.p>
        </div>
      </div>

      {/* ─── Right Panel — Auth Form ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-navy-900 tracking-tight">InvoiceFlow</span>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-3xl shadow-elevated border border-gray-100 p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {/* ─── Email Step ──────────────────────────────── */}
              {step === STEPS.EMAIL && (
                <motion.div
                  key="email-step"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-navy-900">Welcome back</h2>
                    <p className="mt-2 text-sm text-gray-500">
                      Enter your email to receive a verification code. New users
                      will be guided through account setup.
                    </p>
                  </div>

                  <form onSubmit={handleRequestOTP} className="space-y-5">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-2">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                        <input
                          ref={emailInputRef}
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          placeholder="you@company.com"
                          className="input-field pl-11"
                          required
                          autoComplete="email"
                          disabled={loading}
                        />
                      </div>
                    </div>

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
                      disabled={loading || !email.trim()}
                      className="btn-primary w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending code...
                        </>
                      ) : (
                        <>
                          Send verification code
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ─── OTP Step ───────────────────────────────── */}
              {step === STEPS.OTP && (
                <motion.div
                  key="otp-step"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-navy-900">Check your email</h2>
                    <p className="mt-2 text-sm text-gray-500">
                      We sent a 6-digit code to{' '}
                      <span className="font-medium text-navy-700">{email}</span>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOTP} className="space-y-6">
                    {/* OTP Input Boxes */}
                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-3">
                        Verification code
                      </label>
                      <div className="flex gap-3 justify-center" onPaste={handleOtpPaste}>
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => { otpRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            disabled={loading}
                            className="w-12 h-14 text-center text-xl font-bold rounded-xl
                                       border-2 border-gray-200 text-navy-900
                                       focus:border-brand-500 focus:ring-2 focus:ring-brand-200
                                       transition-all duration-200
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Digit ${index + 1} of verification code`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Messages */}
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

                    {success && !error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2 text-sm text-success-600 bg-success-50 rounded-xl px-4 py-3"
                      >
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{success}</span>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || otp.join('').length !== 6}
                      className="btn-primary w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ShieldCheck className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Resend + Back */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => { setStep(STEPS.EMAIL); setError(''); setSuccess(''); }}
                        className="text-sm text-gray-500 hover:text-navy-700 transition-colors"
                      >
                        ← Change email
                      </button>

                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendCooldown > 0 || loading}
                        className="flex items-center gap-1.5 text-sm font-medium
                                   text-brand-600 hover:text-brand-700 transition-colors
                                   disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ─── Success Step ───────────────────────────── */}
              {step === STEPS.SUCCESS && (
                <motion.div
                  key="success-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  >
                    <div className="w-20 h-20 mx-auto bg-success-50 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-success-500" />
                    </div>
                  </motion.div>
                  <h2 className="text-2xl font-bold text-navy-900 mb-2">You&apos;re in!</h2>
                  <p className="text-sm text-gray-500">Redirecting to your dashboard...</p>
                  <div className="mt-6">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer text */}
          <p className="mt-8 text-center text-xs text-gray-400">
            By signing in, you agree to our terms of service and privacy policy.
            <br />
            Your data is encrypted and securely stored.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
