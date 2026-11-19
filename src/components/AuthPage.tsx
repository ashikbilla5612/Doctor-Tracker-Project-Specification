import React, { useState } from 'react';
import { Activity, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to sign in. Please verify your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = () => {
    setMode('login');
    setEmail('admin@doctortracker.org');
    setPassword('Admin@1234');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="lg:col-span-5 bg-slate-900 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight whitespace-nowrap">
                Doctor Tracker
              </span>
            </div>

            <h1 className="mt-8 font-display text-2xl font-semibold leading-snug tracking-tight text-white [text-wrap:balance]">
              Clinical Roster & Patient Operations Portal
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Centralized administration for managing medical staff directories, active patient caseloads, and real-time clinical intake analytics.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6 space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Protected API routes with HMAC token verification</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Indexed search, date-range filters & server pagination</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {mode === 'login' ? 'Administrator Sign In' : 'Create Admin Account'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === 'login'
                  ? 'Authenticate to access doctors, patients, and analytics.'
                  : 'Register a new clinical coordinator credential.'}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Elena Vance"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@doctortracker.org"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter password' : 'Minimum 8 characters'}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-60 whitespace-nowrap"
            >
              {submitting
                ? mode === 'login'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'login'
                  ? 'Sign In to Portal'
                  : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <p className="font-medium text-slate-800">Demo Administrator Credentials</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                  admin@doctortracker.org · Admin@1234
                </p>
              </div>
              <button
                type="button"
                onClick={handleDemoFill}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Use Demo Credentials
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
