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
    if (q.length < MIN_SEARCH_LENGTH) return;
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
        className="sticky top-0 z-50 h-[var(--dsa-header-height)] border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]"
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
        className="dsa-nav-link gap-1 px-2"
      >
        <LogIn size={16} />
        Sign In
      </Link>

      <Link
        href="/auth/login"
        className="dsa-button-primary shrink-0 gap-1 whitespace-nowrap px-3"
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
        "sticky top-0 z-50 overflow-visible border-b transition-colors",
        isScrolled
          ? "border-[var(--dsa-border-strong)] bg-[var(--dsa-surface-1)]"
          : "border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]",
      ].join(" ")}
    >
      <div className="mx-auto flex h-[var(--dsa-header-height)] max-w-[1600px] items-center justify-between gap-2 overflow-visible px-3 phone:px-4 tablet:gap-3 laptop:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 tablet:gap-4 laptop:gap-6">
          <SiteLogo priority />

          <div ref={searchRef} className="relative hidden w-72 md:block laptop:w-[360px]">
            <input
              type="text"
              aria-label="Search company name or ticker"
              placeholder="Search ticker or company"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value.trim().length < MIN_SEARCH_LENGTH) {
                  setSearchResults([]);
                  setSearchSuggestions([]);
                  setSearchLoading(false);
                  setSearchOpen(false);
                }
              }}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim().length >= 2) {
                  setSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              className="dsa-control h-8 w-full py-1.5 pl-9 pr-9 text-[13px] placeholder:text-[var(--dsa-text-muted)] focus:outline-none"
            />
            {searchLoading ? (
              <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--dsa-text-muted)]" />
            ) : (
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dsa-text-muted)]" />
            )}
            {searchOpen && (searchResults.length > 0 || searchSuggestions.length > 0) && (
              <div className="dsa-panel-raised absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto py-1">
                {searchSuggestions.length > 0 && (
                  <div className="mb-1 border-b border-[var(--dsa-border)] px-3 pb-2">
                    <p className="dsa-section-label mb-1.5">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {searchSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSearchQuery(s);
                            setSearchOpen(true);
                          }}
                          className="rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-accent-soft)] px-2.5 py-1 text-xs text-[#b8d1ff] hover:bg-[rgba(76,141,255,0.2)]"
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
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--dsa-surface-3)]"
                  >
                    <span className="w-16 shrink-0 font-mono text-xs font-semibold uppercase text-white">{hit.source?.symbol ?? "—"}</span>
                    <span className="flex-1 truncate text-xs text-[var(--dsa-text-secondary)]">
                      {stripParentheticals(hit.source?.company_name) || "—"}
                    </span>
                  </button>
                ))}
                <Link
                  href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                  onClick={() => setSearchOpen(false)}
                  className="mt-1 block border-t border-[var(--dsa-border)] px-3 py-2 text-xs font-medium text-[#8ab4ff] hover:bg-[var(--dsa-surface-3)]"
                >
                  View all results →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 tablet:gap-3">
          <nav className="no-scrollbar mr-1 hidden min-w-0 laptop:flex laptop:max-w-[min(50vw,40rem)] laptop:items-center laptop:space-x-0.5 laptop:overflow-x-auto">
            {SITE_NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "dsa-nav-link",
                    active ? "dsa-nav-link-active" : "",
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
              className="laptop:hidden rounded-[var(--dsa-radius-sm)] p-2 text-[var(--dsa-text-secondary)] transition hover:bg-[var(--dsa-surface-2)] hover:text-white"
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
          isMenuOpen ? "max-h-screen bg-[var(--dsa-surface-1)] py-3 opacity-100" : "max-h-0 opacity-0"
        } border-t border-[var(--dsa-border)]`}
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
                  "rounded-[var(--dsa-radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--dsa-accent-soft)] text-[#b8d1ff]"
                    : "text-[var(--dsa-text-secondary)] hover:bg-[var(--dsa-surface-2)] hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}

          {!user && (
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--dsa-border)] pt-3">
              <Link
                href="/auth/login"
                className="dsa-button-secondary"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn size={18} /> Sign In
              </Link>
              <Link
                href="/auth/login"
                className="dsa-button-primary"
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