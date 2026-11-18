"use client";

import { useCallback, useEffect, useState } from "react";
import {
  notifyAuthChanged,
  readHasTradingSession,
  readIsLoggedIn,
} from "@/src/libs/session";

export { readIsLoggedIn, readHasTradingSession, notifyAuthChanged };

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refresh = useCallback(() => {
    setIsLoggedIn(readIsLoggedIn());
    setIsChecking(false);
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refresh, 0);
    const onAuth = () => refresh();
    window.addEventListener("storage", onAuth);
    window.addEventListener("auth-changed", onAuth);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("storage", onAuth);
      window.removeEventListener("auth-changed", onAuth);
    };
  }, [refresh]);

  return { isLoggedIn, isChecking, refresh };
}
