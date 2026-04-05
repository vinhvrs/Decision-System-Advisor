'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, KeyRound, ChevronRight } from 'lucide-react';
import { AuthService } from '@/src/services/Auth.service';

type Step = 'email' | 'otp' | 'done';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.forgotPasswordRequest(email.trim());
      setStep('otp');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not send code. Try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.forgotPasswordVerify(email.trim(), otp.trim());
      setStep('done');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid code.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1220] p-6">
      <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/auth/login"
          className="group mb-8 inline-flex items-center gap-2 text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to login</span>
        </Link>

        <div className="rounded-3xl border border-white/5 bg-[#161a21] p-8 shadow-2xl">
          {step === 'email' && (
            <>
              <div className="mb-8">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                  <KeyRound className="text-blue-400" size={28} />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-white">Forgot password?</h1>
                <p className="text-sm leading-relaxed text-white/50">
                  We&apos;ll email a 6-digit code. After you confirm it, we send a random 10-digit temporary password — then
                  sign in and set a new password on the next page.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
              )}

              <form onSubmit={requestOtp} className="space-y-6">
                <div>
                  <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-widest text-white/40">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/20" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full rounded-xl border border-white/5 bg-[#0b1220] py-4 pl-12 pr-4 text-white transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:bg-blue-600/50"
                >
                  {isLoading ? 'Sending…' : 'Send code'}
                  {!isLoading && <ChevronRight size={18} />}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <h1 className="mb-2 text-2xl font-bold text-white">Enter code</h1>
              <p className="mb-6 text-sm text-white/50">Check your inbox for the 6-digit verification code.</p>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
              )}

              <form onSubmit={verifyOtp} className="space-y-6">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-white/5 bg-[#0b1220] py-4 text-center font-mono text-2xl tracking-[0.4em] text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isLoading ? 'Verifying…' : 'Verify & get temporary password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError(null);
                  }}
                  className="w-full text-sm text-white/40 hover:text-white"
                >
                  Use a different email
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="py-2 text-center">
              <h2 className="mb-3 text-2xl font-bold text-white">Check your email</h2>
              <p className="mb-6 text-sm leading-relaxed text-white/50">
                We sent a <strong className="text-white/80">10-digit temporary password</strong>. Use it to sign in, then
                change it immediately — random codes are not meant to stay.
              </p>
              <Link
                href="/auth/new-password"
                className="mb-3 block w-full rounded-xl bg-indigo-600 py-3.5 text-center font-semibold text-white hover:bg-indigo-700"
              >
                Set new password
              </Link>
              <Link href="/auth/login" className="text-sm text-blue-400 hover:text-blue-300">
                Return to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
