'use client';

import { Menu, Search, X, LogIn, UserPlus, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SiteLogo from "@/src/components/brand/SiteLogo";
import UserProfileDropdown from "../../sections/UserProfileDropdown";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";
import { SITE_NAV_LINKS, SITE_NAV_ACTIVE_ALIASES } from "@/src/components/header/nav-config";
import { stripParentheticals } from "@/src/libs/displayString";
import { readIsLoggedIn, readStoredUser, syncAccessTokenFromCookie } from "@/src/libs/session";
import type { User } from "@/src/types/User";

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
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleSelectCompany = useCallback(
    (hit: ElasticCompanyHit) => {
      const sym = hit.source?.symbol;
      if (!sym) return;
      setSearchOpen(false);
      setSearchQuery("");
      router.push(`/companies/profile/${sym.toLowerCase()}`);
    },
    [router]
  );

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }
    const t = setTimeout(() => {
      setSearchLoading(true);
      ElasticService.searchCompanies(q, 10)
        .then(({ items, suggestions }) => {
          setSearchResults(items);
          setSearchSuggestions(suggestions ?? []);
          if (items.length > 0 || (suggestions?.length ?? 0) > 0) setSearchOpen(true);
        })
        .catch(() => {
          setSearchResults([]);
          setSearchSuggestions([]);
        })
        .finally(() => setSearchLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      syncAccessTokenFromCookie();
      setUser(readIsLoggedIn() ? readStoredUser() : null);
      setIsCheckingAuth(false);
    };

    checkAuth();

    const handleAuthChange = () => checkAuth();
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("auth-changed", handleAuthChange);

    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("auth-changed", handleAuthChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (isCheckingAuth) {
    return (
      <header
        className="sticky top-0 z-50 h-14 phone:h-16 border-b border-white/5 bg-[#0b0e14]/90 backdrop-blur-md"
        aria-busy="true"
      />
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    const aliases = SITE_NAV_ACTIVE_ALIASES[href];
    if (aliases) {
      return aliases.some((p) => pathname === p || pathname.startsWith(p + "/"));
    }
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
        href="/auth/login"
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 phone:px-4"
      >
        <UserPlus size={16} className="shrink-0" />
        <span className="hidden phone:inline">Sign Up</span>
        <span className="phone:hidden">Join</span>
      </Link>
    </>
  );

  return (
    <header
      className={[
        "sticky top-0 z-50 overflow-visible border-b transition",
        isScrolled
          ? "bg-[#0b0e14]/90 backdrop-blur-md border-white/10"
          : "bg-transparent border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-14 max-w-[100vw] items-center justify-between gap-2 overflow-visible px-3 phone:h-16 phone:px-4 tablet:gap-3 tablet:px-6 laptop:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 tablet:gap-4 laptop:gap-6">
          <SiteLogo priority />

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
            {searchOpen && (searchResults.length > 0 || searchSuggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 py-2 rounded-xl bg-[#0B1220] border border-white/10 shadow-xl max-h-72 overflow-y-auto z-50">
                {searchSuggestions.length > 0 && (
                  <div className="border-b border-white/5 px-3 pb-2 mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1.5">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {searchSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSearchQuery(s);
                            setSearchOpen(true);
                          }}
                          className="rounded-lg bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-200 hover:bg-indigo-500/25"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.map((hit, idx) => (
                  <button
                    key={hit.id ?? `${hit.source?.symbol ?? "x"}-${idx}`}
                    type="button"
                    onClick={() => handleSelectCompany(hit)}
                    className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition flex items-center gap-3"
                  >
                    <span className="font-semibold text-white uppercase">{hit.source?.symbol ?? "—"}</span>
                    <span className="text-white/70 text-sm truncate flex-1">
                      {stripParentheticals(hit.source?.company_name) || "—"}
                    </span>
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

        <div className="flex shrink-0 items-center gap-2 tablet:gap-3">
          <nav className="hidden min-w-0 laptop:flex laptop:max-w-[min(52vw,42rem)] laptop:items-center laptop:space-x-0.5 laptop:overflow-x-auto laptop:mr-2 laptop:[scrollbar-width:none] laptop:[&::-webkit-scrollbar]:hidden">
            {SITE_NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
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

          <div className="flex shrink-0 items-center gap-2">
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
          {SITE_NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
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