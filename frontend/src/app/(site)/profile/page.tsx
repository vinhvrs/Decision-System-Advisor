import React from "react";
import Link from "next/link";
import { User, Mail, Shield, Camera, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white pt-24 pb-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-white/40">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <ChevronRight size={14} />
          <span className="text-white/80">Settings</span>
          <ChevronRight size={14} />
          <span className="text-blue-400">Profile</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar Settings */}
          <aside className="space-y-2">
            <Link href="/profile" className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-white">
              <User size={18} /> Profile Details
            </Link>
            <Link href="/profile/change-password" className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/50 hover:bg-white/5 transition">
              <Shield size={18} /> Security
            </Link>
          </aside>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-2xl font-bold mb-6">Public Profile</h2>
              
              {/* Avatar Upload */}
              <div className="mb-8 flex items-center gap-6">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-blue-500 to-fuchsia-500 p-1">
                    <div className="h-full w-full rounded-full bg-[#0B1220] flex items-center justify-center overflow-hidden">
                      <span className="text-3xl font-bold">JD</span>
                    </div>
                  </div>
                  <button className="absolute bottom-0 right-0 rounded-full bg-blue-500 p-2 hover:bg-blue-600 transition shadow-lg">
                    <Camera size={16} />
                  </button>
                </div>
                <div>
                  <h3 className="font-medium">Profile Picture</h3>
                  <p className="text-sm text-white/40">PNG, JPG max 5MB</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-white/60">First Name</label>
                    <input type="text" defaultValue="John" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-white/60">Last Name</label>
                    <input type="text" defaultValue="Doe" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/60">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input type="email" readOnly defaultValue="john.doe@example.com" className="w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 py-3 text-white/40 cursor-not-allowed" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/60">Bio</label>
                  <textarea rows={4} placeholder="Tell us about yourself..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>

                <button className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 transition">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}