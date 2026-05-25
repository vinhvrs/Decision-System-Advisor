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
