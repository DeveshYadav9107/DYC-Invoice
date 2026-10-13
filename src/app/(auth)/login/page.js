'use client';

// ─────────────────────────────────────────────────────────────────
// Auth Page — Unified Sign Up & Log In with OTP Verification
// Default view is Sign Up with Name, Phone, Email, Password, Confirm Password.
// Seamless switch to Log In (Email + Password) then 6-digit OTP verification.
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
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

const AUTH_MODES = {
  SIGNUP: 'signup',
  LOGIN: 'login',
};

const STEPS = {
  FORM: 'form',
  OTP: 'otp',
  SUCCESS: 'success',
};

export default function AuthPage() {
  // User requested Sign Up to appear first
  const [mode, setMode] = useState(AUTH_MODES.SIGNUP);
  const [step, setStep] = useState(STEPS.FORM);

  // Sign up fields
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const otpRefs = useRef([]);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);

  // Auto-focus appropriate field on mount or mode change
  useEffect(() => {
    if (step === STEPS.FORM) {
      if (mode === AUTH_MODES.SIGNUP) {
        nameInputRef.current?.focus();
      } else {
        emailInputRef.current?.focus();
      }
    }
  }, [mode, step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ─── Switch Modes (Sign Up <-> Log In) ───────────────────────
  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  // ─── Step 1: Submit Sign Up or Log In Form ───────────────────
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (mode === AUTH_MODES.SIGNUP) {
      // Validate all required sign up fields
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!phoneNumber.trim()) {
        setError('Please enter your phone number.');
        return;
      }
      if (!password) {
        setError('Please create a password (minimum 6 characters).');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your password.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            phoneNumber: phoneNumber.trim(),
            email: trimmedEmail,
            password,
            confirmPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to submit registration.');
          return;
        }

        setSuccess('Verification code sent! Please check your email.');
        setStep(STEPS.OTP);
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // Validate login fields
      if (!password) {
        setError('Please enter your password.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/login-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Login failed. Please check your credentials.');
          return;
        }

        setSuccess('Credentials verified. Verification code sent to your email.');
        setStep(STEPS.OTP);
        setResendCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // ─── Step 2: Handle OTP input ───────────────────────────────
  const handleOtpChange = useCallback((index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);

    setOtp((prev) => {
      const newOtp = [...prev];
      newOtp[index] = digit;
      return newOtp;
    });

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleOtpPaste = useCallback((e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length && i < 6; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);

    const nextEmpty = newOtp.findIndex((d) => !d);
    const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
    otpRefs.current[focusIndex]?.focus();
  }, [otp]);

  // ─── Step 3: Verify OTP ─────────────────────────────────────
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

      // Direct redirection to dashboard without any intermediate page
      setTimeout(() => {
        window.location.href = '/dashboard';
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

      setSuccess('New verification code sent! Check your inbox.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Left panel feature highlights ──────────────────────────
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
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      desc: 'Track processing activity and validation metrics',
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      icon: Download,
      title: 'CSV Export',
      desc: 'Download validated invoices in clean, spreadsheet-ready format',
      gradient: 'from-brand-600 to-brand-800',
    },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50/50">
      {/* ─── Left Panel — Branding (Desktop only) ──────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-brand-950" />

        {/* Geometric light effects */}
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-400 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-emerald-500 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">InvoiceFlow</span>
            </div>
          </motion.div>

          {/* Hero text */}
          <div className="space-y-8 my-auto py-10">
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
              <p className="mt-5 text-base xl:text-lg text-navy-300 max-w-lg leading-relaxed">
                Streamline accounts payable with automated extraction, custom validation rules,
                and instant clean CSV exports.
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm
                             hover:bg-white/10 transition-all duration-300"
                >
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${feature.gradient}
                               flex items-center justify-center mb-3 shadow-md`}
                  >
                    <feature.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-navy-300/80 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-navy-400"
          >
            Bank-grade encryption • Tenant isolation • Fast OCR processing
          </motion.p>
        </div>
      </div>

      {/* ─── Right Panel — Auth Form ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md my-auto"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-navy-900 tracking-tight">InvoiceFlow</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {/* ─── STEP 1: Registration or Login Form ─────────── */}
              {step === STEPS.FORM && (
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-navy-900 tracking-tight">
                      {mode === AUTH_MODES.SIGNUP ? 'Create an account' : 'Welcome back'}
                    </h2>
                    <p className="mt-1.5 text-sm text-gray-500">
                      {mode === AUTH_MODES.SIGNUP
                        ? 'Fill in your details to get started with InvoiceFlow.'
                        : 'Enter your email and password to log in.'}
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmitForm} className="space-y-4">
                    {mode === AUTH_MODES.SIGNUP && (
                      <>
                        {/* Name */}
                        <div>
                          <label
                            htmlFor="signup-name"
                            className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5"
                          >
                            Full Name <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              ref={nameInputRef}
                              id="signup-name"
                              type="text"
                              value={name}
                              onChange={(e) => { setName(e.target.value); setError(''); }}
                              placeholder="Alex Morgan"
                              className="input-field pl-10"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>

                        {/* Phone Number */}
                        <div>
                          <label
                            htmlFor="signup-phone"
                            className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5"
                          >
                            Phone Number <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              id="signup-phone"
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => { setPhoneNumber(e.target.value); setError(''); }}
                              placeholder="+1 (555) 000-0000"
                              className="input-field pl-10"
                              required
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Email (Common to both modes) */}
                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5"
                      >
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={emailInputRef}
                          id="auth-email"
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                          placeholder="you@company.com"
                          className="input-field pl-10"
                          required
                          autoComplete="email"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5"
                      >
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(''); }}
                          placeholder="••••••••"
                          className="input-field pl-10 pr-10"
                          required
                          minLength={6}
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          tabIndex={-1}
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Re-enter Password (Sign Up only) */}
                    {mode === AUTH_MODES.SIGNUP && (
                      <div>
                        <label
                          htmlFor="signup-confirm-password"
                          className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5"
                        >
                          Re-enter Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            id="signup-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                            placeholder="••••••••"
                            className="input-field pl-10 pr-10"
                            required
                            minLength={6}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                            title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error banner */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3"
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-3"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending verification code...
                          </>
                        ) : (
                          <>
                            Send verification code
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Mode Toggle Link */}
                    <div className="pt-3 text-center text-sm text-gray-500">
                      {mode === AUTH_MODES.SIGNUP ? (
                        <p>
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => handleSwitchMode(AUTH_MODES.LOGIN)}
                            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                          >
                            Log In
                          </button>
                        </p>
                      ) : (
                        <p>
                          Don&apos;t have an account?{' '}
                          <button
                            type="button"
                            onClick={() => handleSwitchMode(AUTH_MODES.SIGNUP)}
                            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                          >
                            Sign Up
                          </button>
                        </p>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ─── STEP 2: OTP Verification ───────────────────── */}
              {step === STEPS.OTP && (
                <motion.div
                  key="otp-step"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-navy-900 tracking-tight">
                      Check your email
                    </h2>
                    <p className="mt-1.5 text-sm text-gray-500">
                      We sent a 6-digit verification code to{' '}
                      <span className="font-semibold text-navy-800">{email}</span>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOTP} className="space-y-6">
                    {/* 6 Digit Input Boxes */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-3 text-center">
                        Verification Code
                      </label>
                      <div className="flex gap-2.5 sm:gap-3 justify-center" onPaste={handleOtpPaste}>
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
                            className="w-11 sm:w-12 h-14 text-center text-xl font-bold rounded-xl
                                       border-2 border-gray-200 text-navy-900
                                       focus:border-brand-500 focus:ring-2 focus:ring-brand-200
                                       transition-all duration-200
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Digit ${index + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Messages */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3"
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {success && !error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3"
                      >
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{success}</span>
                      </motion.div>
                    )}

                    {/* Verify button */}
                    <button
                      type="submit"
                      disabled={loading || otp.join('').length !== 6}
                      className="btn-primary w-full py-3"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying code...
                        </>
                      ) : (
                        <>
                          Verify & Complete Sign In
                          <ShieldCheck className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Navigation Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => { setStep(STEPS.FORM); setError(''); setSuccess(''); }}
                        className="text-xs text-gray-500 hover:text-navy-800 transition-colors font-medium"
                      >
                        ← Back to {mode === AUTH_MODES.SIGNUP ? 'Sign Up' : 'Log In'}
                      </button>

                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendCooldown > 0 || loading}
                        className="flex items-center gap-1.5 text-xs font-semibold
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

              {/* ─── STEP 3: Success Transition ────────────────── */}
              {step === STEPS.SUCCESS && (
                <motion.div
                  key="success-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-emerald-600">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="text-2xl font-bold text-navy-900 mb-1.5">You&apos;re in!</h2>
                  <p className="text-sm text-gray-500">Preparing your dashboard...</p>
                  <div className="mt-5">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Privacy footer */}
          <p className="mt-6 text-center text-xs text-gray-400">
            Encrypted credentials • Industry-standard session protection
          </p>
        </motion.div>
      </div>
    </div>
  );
}
