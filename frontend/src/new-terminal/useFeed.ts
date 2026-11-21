"use client";

import { useEffect, useState } from "react";
import { getFeed } from "./feeds";

export function useFeed<T>(path: string | null, refreshMs?: number) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    async function load(url: string) {
      try {
        const data = await getFeed<T>(url, controller.signal);
        if (!controller.signal.aborted) setState({ path: url, data });
      } catch {
        if (!controller.signal.aborted) {
          setState(previous => ({ path: url, data: previous?.path === url ? previous.data : undefined, error: "Pi feed unavailable" }));
        }
      }
    }
    void load(path);
    const timer = refreshMs ? setInterval(() => void load(path), refreshMs) : undefined;
    return () => { controller.abort(); clearInterval(timer); };
  }, [path, refreshMs]);

  return path && state?.path === path ? state : { data: undefined, error: undefined };
}
