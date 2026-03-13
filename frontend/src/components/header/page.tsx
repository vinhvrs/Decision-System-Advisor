'use client';

import { Menu, Search, X, LogIn, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserProfileDropdown from "../../sections/UserProfileDropdown";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "News", href: "/news" },
    { label: "Company", href: "/companies" },
    { label: "Indicator", href: "/indicators" },
    { label: "Strategy", href: "/strategy" },
    { label: "Documents", href: "/documents" },
    { label: "Contact", href: "/contact" },
  ];

  useEffect(() => {
    // auth from localStorage
    try {
      const userString = localStorage.getItem("user");
      if (userString) setUser(JSON.parse(userString));
    } catch {
      setUser(null);
    } finally {
      setIsCheckingAuth(false);
    }

    const handleStorageChange = () => {
      try {
        const userString = localStorage.getItem("user");
        setUser(userString ? JSON.parse(userString) : null);
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // scroll effect
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (isCheckingAuth) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const renderAuthButtons = () => (
    <>
      <Link
        href="/auth/login"
        className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white transition"
      >
        <LogIn size={16} />
        Đăng nhập
      </Link>

      <Link
        href="/auth/login"
        className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition"
      >
        <UserPlus size={16} />
        Đăng ký
      </Link>
    </>
  );

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b transition",
        isScrolled
          ? "bg-[#0B1220]/85 backdrop-blur border-white/10"
          : "bg-transparent border-transparent",
      ].join(" ")}
    >
      <div className="max-w-full mx-auto flex justify-between items-center h-14 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-2xl font-extrabold text-white">
            DSA
          </Link>

          <div className="relative hidden md:block w-64 lg:w-80">
            <input
              type="text"
              placeholder="Tìm kiếm mã cổ phiếu, tin tức..."
              className="p-2 pl-10 rounded-full w-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40
                         focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={[
                    "px-3 py-2 rounded-lg text-sm font-medium transition",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
          </button>

          {user ? <UserProfileDropdown user={user} /> : renderAuthButtons()}
        </div>
      </div>

      <div
        className={`lg:hidden transition-all duration-300 ease-in-out overflow-hidden ${
          isMenuOpen ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0"
        } border-t border-white/10`}
      >
        <nav className="flex flex-col space-y-1 px-2">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={[
                  "px-3 py-2 rounded-md text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {!user && (
            <div className="flex gap-4 p-3 border-t border-white/10 mt-2">
              <Link
                href="/auth/login"
                className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn size={18} /> Đăng nhập
              </Link>
              <Link
                href="/auth/login"
                className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                onClick={() => setIsMenuOpen(false)}
              >
                <UserPlus size={18} /> Đăng ký
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
