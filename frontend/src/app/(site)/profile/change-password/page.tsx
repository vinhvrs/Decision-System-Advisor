"use client";

import React from "react";
import Link from "next/link";
import { User, Shield, Lock, EyeOff, ChevronRight } from "lucide-react";

export default function ChangePasswordPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white pt-24 pb-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-white/40">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <ChevronRight size={14} />
          <span className="text-white/80">Settings</span>
          <ChevronRight size={14} />
          <span className="text-blue-400">Security</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <aside className="space-y-2">
            <Link href="/profile" className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/50 hover:bg-white/5 transition">
              <User size={18} /> Profile Details
            </Link>
            <Link href="/profile/change-password" className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-white">
              <Shield size={18} /> Security
            </Link>
          </aside>

          {/* Main Content */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-2xl font-bold mb-2">Change Password</h2>
              <p className="text-white/40 text-sm mb-8">Update your password to keep your account secure.</p>
              
              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input type="password" placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition">
                      <EyeOff size={18} />
                    </button>
                  </div>
                </div>

                <hr className="border-white/5" />

                <div className="space-y-2">
                  <label className="text-sm text-white/60">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input type="password" placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/60">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input type="password" placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="rounded-xl bg-blue-500/5 p-4 border border-blue-500/10">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Requirements:</p>
                  <ul className="text-xs text-white/50 space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-blue-400" /> At least 8 characters long
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-blue-400" /> Must include one special character
                    </li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-semibold hover:opacity-90 transition shadow-lg shadow-blue-500/20">
                    Update Password
                  </button>
                  <button type="button" className="px-6 rounded-xl border border-white/10 bg-white/5 font-semibold hover:bg-white/10 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}