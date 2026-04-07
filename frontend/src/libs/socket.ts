"use client";

/** Drop path/query/hash so `joinWsUrl(base, "/ws/chatbot")` is not doubled (e.g. env had `/ws/quotes`). */
export function stripWebSocketToOrigin(input: string): string {
  const s = (input || "").trim();
  if (!s) return "ws://127.0.0.1:8000";
  try {
    if (s.startsWith("ws://") || s.startsWith("wss://")) {
      const u = new URL(s);
      return `${u.protocol}//${u.host}`;
    }
    if (s.startsWith("http://")) {
      const u = new URL(s);
      return `ws://${u.host}`;
    }
    if (s.startsWith("https://")) {
      const u = new URL(s);
      return `wss://${u.host}`;
    }
  } catch {
    /* ignore */
  }
  return s.replace(/\/+$/, "");
}

export function normalizeSocketPath(p: string): string {
  const s = (p || "").trim();
  if (!s) return "/ws/quotes";
  return s.startsWith("/") ? s : `/${s}`;
}

export function joinWsUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = normalizeSocketPath(path);
  return `${b}${p}`;
}

export function resolveWsBase(): string {
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search);
      const qsBase = (qs.get("wsBase") || "").trim();
      if (qsBase) return stripWebSocketToOrigin(qsBase);

      const qsHost = (qs.get("wsHost") || "").trim();
      if (qsHost) {
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const port = (qs.get("wsPort") || process.env.NEXT_PUBLIC_SOCKET_PORT || "8000").trim();
        return stripWebSocketToOrigin(`${proto}://${qsHost}:${port}`);
      }

      const stored = (localStorage.getItem("DSA_WS_BASE") || "").trim();
      if (stored) return stripWebSocketToOrigin(stored);
    } catch {
      /* empty */
    }
  }

  const raw = (process.env.NEXT_PUBLIC_SOCKET || "").trim();
  if (raw) {
    if (raw.startsWith("http://")) {
      return stripWebSocketToOrigin(`ws://${raw.slice("http://".length)}`);
    }
    if (raw.startsWith("https://")) {
      return stripWebSocketToOrigin(`wss://${raw.slice("https://".length)}`);
    }
    return stripWebSocketToOrigin(raw);
  }

  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port = (process.env.NEXT_PUBLIC_SOCKET_PORT || "8000").trim();
    return stripWebSocketToOrigin(`${proto}://${host}:${port}`);
  }

  return stripWebSocketToOrigin("ws://127.0.0.1:8000");
}

export class SimpleSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: (data: unknown) => void;
  private disconnectRequested = false;

  constructor(onMessage: (data: unknown) => void) {
    const base = resolveWsBase();
    const path = process.env.NEXT_PUBLIC_SOCKET_PATH || "/ws/quotes";
    this.url = joinWsUrl(base, path);
    this.onMessageCallback = onMessage;
  }

  connect() {
    this.disconnectRequested = false;
    this.ws = new WebSocket(this.url);
    if (process.env.NODE_ENV === "development") {
      console.log("[WS] Connecting:", this.url);
    }
    this.ws.onopen = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[WS] Connected");
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback(data);
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.disconnectRequested) {
        if (process.env.NODE_ENV === "development") {
          console.log("[WS] Disconnected, reconnect in 3s");
        }
        setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[WS] connection issue");
      }
    };
  }

  send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.disconnectRequested = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}