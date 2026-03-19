"use client";

function normalizePath(p: string): string {
  const s = (p || "").trim();
  if (!s) return "/ws/quotes";
  return s.startsWith("/") ? s : `/${s}`;
}

function joinWsUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = normalizePath(path);
  return `${b}${p}`;
}

function resolveWsBase(): string {
  // Runtime overrides (no rebuild needed)
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search);
      const qsBase = (qs.get("wsBase") || "").trim(); // e.g. ws://192.168.2.14:8000
      if (qsBase) return qsBase;

      const qsHost = (qs.get("wsHost") || "").trim(); // e.g. 192.168.2.14
      if (qsHost) {
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const port = (qs.get("wsPort") || process.env.NEXT_PUBLIC_SOCKET_PORT || "8000").trim();
        return `${proto}://${qsHost}:${port}`;
      }

      const stored = (localStorage.getItem("DSA_WS_BASE") || "").trim();
      if (stored) return stored;
    } catch {
      // ignore
    }
  }

  const raw = (process.env.NEXT_PUBLIC_SOCKET || "").trim();
  if (raw) {
    // allow http(s) base and convert to ws(s)
    if (raw.startsWith("http://")) return `ws://${raw.slice("http://".length)}`;
    if (raw.startsWith("https://")) return `wss://${raw.slice("https://".length)}`;
    return raw; // assume ws(s):// or host:port
  }

  // Fallback: use current hostname so it works on LAN/phone
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port = (process.env.NEXT_PUBLIC_SOCKET_PORT || "8000").trim();
    return `${proto}://${host}:${port}`;
  }

  return "ws://127.0.0.1:8000";
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
      console.log("🔌 [WS] Connecting to:", this.url);
    }
    this.ws.onopen = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("🚀 [WS] Connected");
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback(data);
      } catch (err) {
        console.error("❌ [WS] Parse error:", err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.disconnectRequested) {
        if (process.env.NODE_ENV === "development") {
          console.log("🔌 [WS] Disconnected. Reconnecting in 3s...");
        }
        setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      // Browser often provides empty error object; avoid noisy console
      if (process.env.NODE_ENV === "development") {
        console.debug("[WS] Connection issue (server may be offline)");
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