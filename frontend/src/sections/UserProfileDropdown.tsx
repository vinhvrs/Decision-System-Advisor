"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { ChevronDown, Settings, LogOut, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthService } from "../services/Auth.service";
import { stripParentheticals } from "@/src/libs/displayString";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role?: string;
}

interface UserProfileDropdownProps {
  user: User;
}

function UserProfileDropdown({ user }: UserProfileDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    close();
    try {
      await AuthService.logout();
      router.replace("/auth/login");
    } catch {
      alert("Sign out failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getInitial = (name: string): string => {
    if (!name) return "U";
    return name.trim().charAt(0).toUpperCase();
  };

  const displayName =
    stripParentheticals(user.name || "").trim() ||
    user.username?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  const menuItemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/5 hover:text-white";

  return (
    <div className="relative z-[60]" ref={dropdownRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={[
          "flex items-center gap-2 rounded-full border px-2 py-1.5 text-white transition duration-150",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/60",
          isOpen
            ? "border-white/20 bg-white/10"
            : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/10",
        ].join(" ")}
        onClick={() => setIsOpen((open) => !open)}
        disabled={isLoggingOut}
      >
        <span className="hidden max-w-[8rem] truncate font-medium text-white/90 sm:block">
          {displayName}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-sm font-bold text-indigo-100">
          {getInitial(displayName)}
        </div>
        <ChevronDown
          size={16}
          className={[
            "shrink-0 text-white/50 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-60 rounded-xl border border-white/10 bg-[#0b1220] py-1.5 shadow-2xl shadow-black/50"
        >
          <div className="border-b border-white/10 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-white/45">{user.email}</p>
          </div>

          <div className="p-1.5">
            <Link
              href="/profile"
              role="menuitem"
              onClick={close}
              className={menuItemClass}
            >
              <Settings size={16} className="shrink-0 text-white/50" />
              Account settings
            </Link>

            {(user.role === "admin" || user.role === "staff") && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={close}
                className={menuItemClass}
              >
                <Shield size={16} className="shrink-0 text-white/50" />
                Admin dashboard
              </Link>
            )}
          </div>

          <div className="border-t border-white/10 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : (
                <LogOut size={16} className="shrink-0" />
              )}
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(UserProfileDropdown);
