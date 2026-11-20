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
  private onOpenCallback?: () => void;
  private onConnectionChange?: (connected: boolean) => void;
  private disconnectRequested = false;

  constructor(onMessage: (data: unknown) => void, onOpen?: () => void, onConnectionChange?: (connected: boolean) => void) {
    const base = resolveWsBase();
    const path = process.env.NEXT_PUBLIC_SOCKET_PATH || "/ws/quotes";
    this.url = joinWsUrl(base, path);
    this.onMessageCallback = onMessage;
    this.onOpenCallback = onOpen;
    this.onConnectionChange = onConnectionChange;
  }

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatDeadline: ReturnType<typeof setTimeout> | null = null;
  private heartbeatAwaitingPong = false;
  private subscription: unknown = null;
  private retries = 0;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.disconnectRequested = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws || this.disconnectRequested) return;
      this.retries = 0;
      this.onConnectionChange?.(true);
      if (this.subscription) ws.send(JSON.stringify(this.subscription));
      this.onOpenCallback?.();
      this.clearHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
        if (this.heartbeatAwaitingPong) return;
        this.heartbeatAwaitingPong = true;
        ws.send(JSON.stringify({ type: "ping", sent_at: Date.now() }));
        this.heartbeatDeadline = setTimeout(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN && this.heartbeatAwaitingPong) ws.close(4000, "quote heartbeat timeout");
        }, 65_000);
      }, 25_000);
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws || this.disconnectRequested) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "pong") {
          this.heartbeatAwaitingPong = false;
          if (this.heartbeatDeadline) clearTimeout(this.heartbeatDeadline);
          this.heartbeatDeadline = null;
          return;
        }
        this.onMessageCallback(data);
      }
      catch (error) { console.warn("Quote message failed", error); }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.clearHeartbeat();
      this.ws = null;
      this.onConnectionChange?.(false);
      if (!this.disconnectRequested) {
        const delay = Math.min(30_000, 1000 * 2 ** this.retries++);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          if (!this.disconnectRequested) this.connect();
        }, delay);
      }
    };
    ws.onerror = () => { if (this.ws === ws) ws.close(); };
  }

  send(data: unknown) {
    if (data && typeof data === "object" && "type" in data && data.type === "subscribe") this.subscription = data;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  disconnect() {
    this.disconnectRequested = true;
    this.onConnectionChange?.(false);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.subscription = null;
    this.clearHeartbeat();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatDeadline) clearTimeout(this.heartbeatDeadline);
    this.heartbeatTimer = null;
    this.heartbeatDeadline = null;
    this.heartbeatAwaitingPong = false;
  }
}
