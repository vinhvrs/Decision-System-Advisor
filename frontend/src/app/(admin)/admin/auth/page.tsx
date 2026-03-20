"use client";

import React, { useState, useEffect } from "react";
import { AuthService } from "@/src/services/Auth.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

export default function AdminAuthPage() {
  const router = useRouter();
  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const parsed = JSON.parse(u);
        if (parsed?.role === "admin" || parsed?.role === "staff") {
          router.replace("/admin");
        }
      } catch {
        /* ignore */
      }
    }
  }, [router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.loginAdmin({ email, password, remember });
      router.replace("/admin");
    } catch (err: any) {
      if (err?.message === "FORBIDDEN") {
        alert("Forbidden. Admin or staff role required.");
        router.replace("/auth/login");
        return;
      }
      const errorMessage =
        err?.response?.data?.message ||
        (err?.response?.status === 429
          ? "Too many attempts. Please try again later."
          : "Login failed. Please check your email and password.");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#161D2C] border border-white/10 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-blue-500/20 mb-4">
            <Shield size={32} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Sign In</h1>
          <p className="text-white/50 text-sm mt-2">
            Admin and staff only. Others will be redirected.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-white/80 mb-1">
              Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-white/80 mb-1">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center">
            <input
              id="admin-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="admin-remember" className="ml-2 text-sm text-white/60">
              Remember me (7 days)
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              isLoading
                ? "bg-blue-500/50 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500"
            } text-white`}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Not admin?{" "}
          <Link href="/auth/login" className="text-blue-400 hover:underline">
            Sign in as regular user
          </Link>
        </p>
      </div>
    </div>
  );
}
