"use client";

import { useCallback, useEffect, useState } from "react";

export function readIsLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    const user = localStorage.getItem("user");
    return Boolean(token && user);
  } catch {
    return false;
  }
}

export function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-changed"));
  }
}

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refresh = useCallback(() => {
    setIsLoggedIn(readIsLoggedIn());
    setIsChecking(false);
  }, []);

  useEffect(() => {
    refresh();
    const onAuth = () => refresh();
    window.addEventListener("storage", onAuth);
    window.addEventListener("auth-changed", onAuth);
    return () => {
      window.removeEventListener("storage", onAuth);
      window.removeEventListener("auth-changed", onAuth);
    };
  }, [refresh]);

  return { isLoggedIn, isChecking, refresh };
}
