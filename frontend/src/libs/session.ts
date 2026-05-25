import type { User } from "@/src/types/User";

export function getRememberTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)dsa_remember=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Copy remember cookie into localStorage so Bearer matches the latest login. */
export function syncAccessTokenFromCookie(): boolean {
  const fromCookie = getRememberTokenFromCookie();
  if (!fromCookie) return false;
  localStorage.setItem("accessToken", fromCookie);
  return true;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  syncAccessTokenFromCookie();
  return localStorage.getItem("accessToken") || localStorage.getItem("token");
}

export function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function readIsLoggedIn(): boolean {
  return Boolean(getAccessToken() && readStoredUser());
}

export function readHasTradingSession(): boolean {
  if (typeof window === "undefined") return false;
  if (getAccessToken()) return true;
  return Boolean(getRememberTokenFromCookie());
}

export function clearClientSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = "dsa_remember=; path=/; max-age=0";
  window.dispatchEvent(new CustomEvent("auth-changed"));
}

export function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-changed"));
  }
}
