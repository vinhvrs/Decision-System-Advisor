'use client';

import { Menu, Search, X, LogIn, UserPlus, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import UserProfileDropdown from "../../sections/UserProfileDropdown";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ElasticCompanyHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: "Search", href: "/search" },
    { label: "News", href: "/news" },
    { label: "Company", href: "/companies" },
    { label: "Indicators", href: "/indicators" },
    { label: "Strategy", href: "/strategy" },
    { label: "Documents", href: "/documents" },
    { label: "Contact", href: "/contact" },
  ];

  useEffect(() => {
    // auth from localStorage
    const checkAuth = () => {
      try {
        const userString = localStorage.getItem("user");
        if (userString) setUser(JSON.parse(userString));
        else setUser(null);
      } catch {
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    const handleStorageChange = () => checkAuth();
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
        Sign In
      </Link>

      <Link
        href="/auth/login" // You can change to /auth/register if you split the pages
        className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition shadow-lg shadow-indigo-500/20"
      >
        <UserPlus size={16} />
        Sign Up
      </Link>
    </>
  );

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b transition",
        isScrolled
          ? "bg-[#0b0e14]/90 backdrop-blur-md border-white/10"
          : "bg-transparent border-transparent",
      ].join(" ")}
    >
      <div className="max-w-full mx-auto flex justify-between items-center h-14 phone:h-16 px-3 phone:px-4 tablet:px-6 laptop:px-8">
        <div className="flex items-center gap-4 tablet:gap-8">
          <Link href="/" className="text-xl phone:text-2xl font-black tracking-tighter text-white">
            DSA<span className="text-indigo-500">.</span>
          </Link>

          <div ref={searchRef} className="relative hidden md:block w-64 lg:w-96">
            <input
              type="text"
              placeholder="Search company name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim().length >= 2) {
                  setSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              className="py-2 pl-10 pr-10 rounded-xl w-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all"
            />
            {searchLoading ? (
              <Loader2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 animate-spin" />
            ) : (
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            )}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 py-2 rounded-xl bg-[#0B1220] border border-white/10 shadow-xl max-h-72 overflow-y-auto z-50">
                {searchResults.map((hit) => (
                  <button
                    key={hit.id ?? hit.source?.symbol ?? Math.random()}
                    type="button"
                    onClick={() => handleSelectCompany(hit)}
                    className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition flex items-center gap-3"
                  >
                    <span className="font-semibold text-white uppercase">{hit.source?.symbol ?? "—"}</span>
                    <span className="text-white/70 text-sm truncate flex-1">{hit.source?.company_name ?? "—"}</span>
                  </button>
                ))}
                <Link
                  href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => setSearchOpen(false)}
                  className="block px-4 py-2.5 text-indigo-400 hover:bg-white/5 text-sm font-medium border-t border-white/5 mt-1"
                >
                  View all results →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden laptop:flex items-center space-x-1 mr-4">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={[
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <UserProfileDropdown user={user} />
            ) : (
              renderAuthButtons()
            )}

            <button
              className="laptop:hidden p-2 rounded-lg hover:bg-white/5 transition"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`laptop:hidden transition-all duration-300 ease-in-out overflow-hidden ${
          isMenuOpen ? "max-h-screen opacity-100 py-4 bg-[#0b0e14]" : "max-h-0 opacity-0"
        } border-t border-white/10`}
      >
        <nav className="flex flex-col space-y-1 px-4">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={[
                  "px-4 py-3 rounded-xl text-base font-medium transition",
                  active ? "bg-indigo-600/20 text-indigo-400" : "text-white/70 hover:bg-white/5",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {!user && (
            <div className="flex flex-col gap-3 pt-4 border-t border-white/10 mt-4">
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white/80 border border-white/10 hover:bg-white/5"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn size={18} /> Sign In
              </Link>
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setIsMenuOpen(false)}
              >
                <UserPlus size={18} /> Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}