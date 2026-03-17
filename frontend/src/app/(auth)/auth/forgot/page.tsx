/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, KeyRound, CheckCircle2, ChevronRight } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Giả lập gửi request reset password
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-[#0b1220] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Back link */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to login</span>
        </Link>

        <div className="bg-[#161a21] border border-white/5 rounded-3xl p-8 shadow-2xl">
          {!isSubmitted ? (
            <>
              {/* Step 1: Request Reset */}
              <div className="mb-8">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                  <KeyRound className="text-blue-400" size={28} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
                <p className="text-white/50 text-sm leading-relaxed">
                  No worries, we&apos;ll send you reset instructions. Please enter the email address linked to your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2 ml-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-[#0b1220] border border-white/5 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group"
                >
                  {isLoading ? "Sending link..." : "Reset Password"}
                  {!isLoading && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>
            </>
          ) : (
            /* Step 2: Success State */
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-green-500/20 animate-bounce">
                <CheckCircle2 className="text-green-400" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                We&apos;ve sent a password reset link to <br />
                <span className="text-white font-medium">{email}</span>
              </p>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setIsSubmitted(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-xl transition-all border border-white/5"
                >
                  Didn&apos;t receive the email? Click to resend
                </button>
                
                <Link 
                  href="/login"
                  className="block text-blue-400 hover:text-blue-300 text-sm font-bold transition-colors"
                >
                  Return to login
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Support Link */}
        <p className="text-center mt-8 text-white/30 text-xs">
          Need more help? <Link href="/contact" className="text-white/60 hover:text-white underline underline-offset-4">Contact Support</Link>
        </p>
      </div>
    </main>
  );
}