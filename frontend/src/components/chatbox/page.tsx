/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronUp, MessageCircle, RefreshCw, X } from "lucide-react";
import { CHATBOT_SCOPE_STORAGE_KEY } from "@/src/constants/chatbotScope";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { stripParentheticals } from "@/src/libs/displayString";
import { joinWsUrl, resolveWsBase } from "@/src/libs/socket";
import type { ElasticCompanyHit } from "@/src/services/Elastic.service";
import { searchChatboxCompaniesIndexed, seedChatboxCompaniesFromApi } from "@/src/libs/chatboxCompanyIdb";
import { ChatMessage } from "../../types/ChatMessage";
import {
  runScopeApiFallback,
  shouldUseScopeApiFallback,
  SCOPE_CLIENT_ONLY_IDS,
} from "@/src/components/chatbox/chatboxScopeApi";

type ServerOption = { id: string; title: string; description?: string; api_focus_label?: string };

const TYPEAHEAD_MIN_LEN = 2;
const TYPEAHEAD_DEBOUNCE_MS = 280;

const WELCOME_TEXT =
  "Auto: send empty (or type a ticker / company name) for top mixed BUY/SELL picks vs single-name analysis. Other focuses add context to your question.";

function chatbotWsUrl(): string {
  const override = (process.env.NEXT_PUBLIC_CHATBOT_WS || "").trim();
  if (override.startsWith("ws://") || override.startsWith("wss://")) {
    return override;
  }
  const path = (process.env.NEXT_PUBLIC_CHATBOT_WS_PATH || "/ws/chatbot").trim() || "/ws/chatbot";
  return joinWsUrl(resolveWsBase(), path.startsWith("/") ? path : `/${path}`);
}

function payloadToBotMessages(payload: any): { from: "bot"; text: string }[] {
  if (payload.type === "error") {
    const t =
      typeof payload.response === "string"
        ? payload.response
        : (payload.message as string) || "Something went wrong.";
    return [{ from: "bot", text: t }];
  }

  if (payload.type === "chat") {
    return [
      {
        from: "bot",
        text:
          typeof payload.response === "string"
            ? payload.response
            : payload.response?.message ?? "—",
      },
    ];
  }

  if (payload.type === "news") {
    const summary = payload.response.summary ?? "Latest updates:";
    const items = payload.response.items ?? [];
    const text = [
      summary,
      "",
      ...items.map((item: any, idx: number) => `${idx + 1}. ${item.topic}\n${item.excerpt}`),
    ].join("\n\n");
    return [{ from: "bot", text }];
  }

  if (payload.type === "advice" || payload.type === "advice_multi") {
    const results = payload.results ?? [];
    const summary =
      typeof payload.summary === "string" && payload.summary.trim() ? `${payload.summary.trim()}\n\n` : "";
    const blocks = results.map((result: any) => {
      const highlights = result.response.highlights?.length
        ? result.response.highlights.map((h: string) => `• ${h}`).join("\n")
        : "";
      const warnings = result.response.warnings?.length
        ? result.response.warnings.map((w: string) => `• ${w}`).join("\n")
        : "• None";
      const text = [
        `${result.symbol} — ${result.response.recommendation}`,
        "",
        highlights,
        "",
        result.response.message,
        "",
        "Warnings:",
        warnings,
        "",
        `Confidence: ${result.response.confidence}%`,
      ]
        .filter(Boolean)
        .join("\n");
      return { from: "bot" as const, text };
    });
    if (summary && blocks.length) {
      const [first, ...rest] = blocks;
      return [
        { from: "bot" as const, text: `${summary.trimEnd()}\n\n${first.text}` },
        ...rest,
      ];
    }
    return blocks;
  }

  return [{ from: "bot", text: "Unexpected response from the chat service." }];
}

export default function ChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [serverOptions, setServerOptions] = useState<ServerOption[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingTypingRef = useRef(false);
  const pendingFallbackRef = useRef<{ scope: string; raw: string } | null>(null);
  const disconnectChatRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusMenuRef = useRef<HTMLDivElement | null>(null);
  const composerTypeaheadRef = useRef<HTMLDivElement | null>(null);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);

  const [elasticHits, setElasticHits] = useState<ElasticCompanyHit[]>([]);
  const [typeaheadLoading, setTypeaheadLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestHighlight, setSuggestHighlight] = useState(-1);

  const debouncedInput = useDebouncedValue(input, TYPEAHEAD_DEBOUNCE_MS);

  const readStoredScope = useCallback((): string | null => {
    try {
      const raw = sessionStorage.getItem(CHATBOT_SCOPE_STORAGE_KEY);
      if (raw === "indicator" || raw === "strategy") return "analysis";
      if (raw && ["analyze", "news", "companies", "analysis"].includes(raw)) {
        return raw;
      }
    } catch {
      /* empty */
    }
    return null;
  }, []);

  const persistScope = useCallback((id: string | null) => {
    setScope(id);
    try {
      if (id) sessionStorage.setItem(CHATBOT_SCOPE_STORAGE_KEY, id);
      else sessionStorage.removeItem(CHATBOT_SCOPE_STORAGE_KEY);
    } catch {
      /* empty */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void seedChatboxCompaniesFromApi();
  }, [open]);

  useEffect(() => {
    if (!focusMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (focusMenuRef.current && !focusMenuRef.current.contains(e.target as Node)) {
        setFocusMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [focusMenuOpen]);

  useEffect(() => {
    if (!suggestOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (composerTypeaheadRef.current && !composerTypeaheadRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [suggestOpen]);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (q.length < TYPEAHEAD_MIN_LEN) {
      setElasticHits([]);
      setTypeaheadLoading(false);
      setSuggestOpen(false);
      return;
    }
    let cancelled = false;
    setTypeaheadLoading(true);
    setSuggestOpen(true);
    void (async () => {
      try {
        const items = await searchChatboxCompaniesIndexed(q, 12);
        if (cancelled) return;
        setElasticHits(items);
        setSuggestOpen(items.length > 0);
        setSuggestHighlight(-1);
      } catch {
        if (!cancelled) {
          setElasticHits([]);
          setSuggestOpen(false);
        }
      } finally {
        if (!cancelled) setTypeaheadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedInput]);

  useEffect(() => {
    if (input.trim().length < TYPEAHEAD_MIN_LEN) {
      setSuggestOpen(false);
      setElasticHits([]);
    }
  }, [input]);

  const applyElasticPick = useCallback((hit: ElasticCompanyHit) => {
    const sym = hit.source?.symbol?.trim();
    const name = stripParentheticals(hit.source?.company_name || "");
    if (sym) {
      setInput(sym);
    } else if (name) {
      setInput(name);
    }
    setSuggestOpen(false);
    setElasticHits([]);
    setSuggestHighlight(-1);
  }, []);

  useEffect(() => {
    if (!open) {
      disconnectChatRef.current = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsReady(false);
      setConnectError(null);
      return;
    }

    disconnectChatRef.current = false;
    setMessages([{ from: "bot", text: WELCOME_TEXT }]);
    setServerOptions([]);
    setScope(readStoredScope());
    setConnectError(null);
    setWsReady(false);

    const attachHandlers = (ws: WebSocket, url: string) => {
      ws.onopen = () => {
        setConnectError(null);
        setWsReady(true);
        try {
          ws.send(JSON.stringify({ type: "get_chatbot_options" }));
        } catch {
          /* empty */
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          const t = data.type as string;

          if (t === "chatbot_options" && Array.isArray(data.options)) {
            setServerOptions(data.options as ServerOption[]);
            return;
          }

          if (t === "pong") return;

          if (t === "chatbot_error") {
            pendingTypingRef.current = false;
            const err = String(data.message ?? "Request failed.");
            const fb = pendingFallbackRef.current;
            pendingFallbackRef.current = null;
            if (fb && shouldUseScopeApiFallback(fb.scope)) {
              void runScopeApiFallback(fb.scope, fb.raw)
                .then((msgs) => {
                  setMessages((prev) => [...prev.slice(0, -1), ...msgs]);
                })
                .catch(() => {
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.from === "bot" && last.text === "Thinking…") {
                      return [...prev.slice(0, -1), { from: "bot", text: err }];
                    }
                    return [...prev, { from: "bot", text: err }];
                  });
                });
              return;
            }
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.from === "bot" && last.text === "Thinking…") {
                return [...prev.slice(0, -1), { from: "bot", text: err }];
              }
              return [...prev, { from: "bot", text: err }];
            });
            return;
          }

          if (t === "chatbot_response" && data.payload) {
            pendingTypingRef.current = false;
            const pay = data.payload as Record<string, unknown>;
            const fb = pendingFallbackRef.current;
            if (pay.type === "error" && fb && shouldUseScopeApiFallback(fb.scope)) {
              pendingFallbackRef.current = null;
              void runScopeApiFallback(fb.scope, fb.raw)
                .then((msgs) => {
                  setMessages((prev) => [...prev.slice(0, -1), ...msgs]);
                })
                .catch(() => {
                  setMessages((prev) => [
                    ...prev.slice(0, -1),
                    ...payloadToBotMessages(pay),
                  ]);
                });
              return;
            }
            pendingFallbackRef.current = null;
            const botMessages = payloadToBotMessages(pay);
            setMessages((prev) => [...prev.slice(0, -1), ...botMessages]);
            return;
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        const httpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
        const mixed =
          httpsPage && url.startsWith("ws://")
            ? " Secure pages require a matching secure (wss) chat endpoint."
            : "";
        setConnectError(
          `We cannot reach the chat service right now.${mixed} Please check your connection or try again in a moment.`
        );
        setWsReady(false);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setWsReady(false);
        if (disconnectChatRef.current) return;
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (disconnectChatRef.current) return;
          const nextUrl = chatbotWsUrl();
          const next = new WebSocket(nextUrl);
          wsRef.current = next;
          attachHandlers(next, nextUrl);
        }, 4000);
      };
    };

    const url = chatbotWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    attachHandlers(ws, url);

    return () => {
      disconnectChatRef.current = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [open, readStoredScope]);

  const requestChatbotOptions = useCallback(() => {
    const w = wsRef.current;
    if (w && w.readyState === WebSocket.OPEN) {
      w.send(JSON.stringify({ type: "get_chatbot_options" }));
    }
  }, []);

  const sendMessage = async () => {
    const raw = input.trim();
    const isAuto = scope === null;
    if (!isAuto && !raw && scope !== "news" && scope !== "companies" && scope !== "analysis")
      return;

    const userLabel =
      isAuto && !raw
        ? "Top BUY/SELL picks (Auto)"
        : !isAuto && !raw && scope === "news"
          ? "Latest headlines"
          : !isAuto && !raw && scope === "companies"
            ? "Top company sample"
            : !isAuto && !raw && scope === "analysis"
              ? "Volume movers"
              : raw;
    setInput("");
    setMessages((prev) => [...prev, { from: "user", text: userLabel }]);
    pendingTypingRef.current = true;
    setMessages((prev) => [...prev, { from: "bot", text: "Thinking…" }]);

    // News / companies / analysis: site REST APIs only (headlines, search, movers) — not the analysis WS.
    if (!isAuto && scope && SCOPE_CLIENT_ONLY_IDS.has(scope)) {
      pendingFallbackRef.current = null;
      try {
        const msgs = await runScopeApiFallback(scope, raw);
        pendingTypingRef.current = false;
        setMessages((prev) => [...prev.slice(0, -1), ...msgs]);
      } catch {
        pendingTypingRef.current = false;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { from: "bot", text: "Could not load data from the API. Try again or open the matching page on the site." },
        ]);
      }
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (!isAuto && scope) {
      pendingFallbackRef.current = { scope, raw };
    } else {
      pendingFallbackRef.current = null;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "chat_message",
        message: raw,
        scope: scope ?? undefined,
        style: "standard",
      })
    );
  };

  const scopePills = serverOptions.length
    ? serverOptions
    : [
        { id: "analyze", title: "Analyze" },
        { id: "news", title: "News" },
        { id: "companies", title: "Companies" },
        { id: "analysis", title: "Indicators & Strategy" },
      ];

  const currentFocusLabel =
    scope === null ? "Auto" : scopePills.find((p) => p.id === scope)?.title ?? scope;

  const isAutoFocus = scope === null;
  const emptyOkForScope =
    scope === "news" || scope === "companies" || scope === "analysis";
  const clientOnlyFocus = scope != null && SCOPE_CLIENT_ONLY_IDS.has(scope);
  const canSend =
    (clientOnlyFocus || wsReady) &&
    (isAutoFocus || input.trim().length > 0 || emptyOkForScope);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans text-[13px]">
      {!open && (
        <button
          type="button"
          title="Open chat"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] text-[#c4b5fd] shadow-lg shadow-black/40 transition hover:border-[#5a5a5a] hover:bg-[#252526]"
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
        </button>
      )}

      {open && (
        <div
          className="flex h-[min(85vh,620px)] w-[min(100vw-1.5rem,440px)] flex-col overflow-hidden rounded-xl border border-[#2d2d2d] bg-[#181818] shadow-2xl shadow-black/50"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset" }}
        >
          {/* Header — Cursor-like */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#2d2d2d] bg-[#1e1e1e] px-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[12px] font-medium tracking-tight text-[#cccccc]">Chat</span>
              <span className="rounded border border-[#3c3c3c] bg-[#252526] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#8b8b8b]">
                DSA
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                title="Reload focus options from server"
                disabled={!wsReady}
                onClick={() => requestChatbotOptions()}
                className="rounded p-1.5 text-[#8b8b8b] transition hover:bg-[#2d2d2d] hover:text-[#cccccc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw size={14} aria-hidden />
              </button>
              <button
                type="button"
                title="Close"
                className="rounded p-1.5 text-[#8b8b8b] transition hover:bg-[#2d2d2d] hover:text-[#cccccc]"
                onClick={() => setOpen(false)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>

          {connectError && (
            <div className="shrink-0 border-b border-[#2d2d2d] bg-[#1e1e1e] px-3 py-2 text-[11px] text-red-400/90">
              {connectError}
            </div>
          )}
          {!wsReady && !connectError && (
            <div className="shrink-0 border-b border-[#2d2d2d] bg-[#1e1e1e] px-3 py-2 font-mono text-[11px] text-[#6e6e6e]">
              Connecting to chat…
            </div>
          )}

          {/* Thread */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-5">
              {messages.map((msg, idx) => {
                const isUser = msg.from === "user";
                if (isUser) {
                  return (
                    <div key={idx} className="flex justify-end">
                      <div className="max-w-[92%] rounded-lg border border-[#3c3c3c] bg-[#252526] px-3 py-2 text-[13px] leading-relaxed text-[#e0e0e0]">
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex gap-3">
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#3c3c3c] bg-[#252526] font-mono text-[10px] font-semibold text-[#a78bfa]"
                      aria-hidden
                    >
                      DSA
                    </div>
                    <div className="min-w-0 flex-1 border-l border-[#3c3c3c] pl-3 text-[13px] leading-relaxed text-[#cccccc] whitespace-pre-line">
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Composer — Cursor-style + drop-up focus */}
          <div className="shrink-0 border-t border-[#2d2d2d] bg-[#1e1e1e] p-3">
            <div ref={focusMenuRef} className="relative mb-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-[#3c3c3c] bg-[#252526] px-2.5 py-2 text-left transition hover:border-[#5a5a5a]"
                onClick={() => setFocusMenuOpen((v) => !v)}
                aria-expanded={focusMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#6e6e6e]">
                  Focus
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#e0e0e0]">{currentFocusLabel}</span>
                <ChevronUp
                  size={16}
                  className={`shrink-0 text-[#8b8b8b] transition-transform ${focusMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {focusMenuOpen && (
                <ul
                  className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-[min(280px,42vh)] overflow-y-auto rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] py-1 shadow-xl"
                  role="listbox"
                >
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={scope === null}
                      className={`w-full px-3 py-2 text-left font-mono text-[12px] transition hover:bg-[#2d2d2d] ${
                        scope === null ? "bg-[#6b5cd1]/20 text-[#d4c4fc]" : "text-[#cccccc]"
                      }`}
                      onClick={() => {
                        persistScope(null);
                        setFocusMenuOpen(false);
                      }}
                    >
                      Auto
                    </button>
                  </li>
                  {scopePills.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={scope === opt.id}
                        title={opt.description}
                        className={`w-full px-3 py-2 text-left font-mono text-[12px] transition hover:bg-[#2d2d2d] ${
                          scope === opt.id ? "bg-[#6b5cd1]/20 text-[#d4c4fc]" : "text-[#cccccc]"
                        }`}
                        onClick={() => {
                          persistScope(opt.id);
                          setFocusMenuOpen(false);
                        }}
                      >
                        {opt.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              ref={composerTypeaheadRef}
              className="relative flex items-end gap-2 rounded-lg border border-[#3c3c3c] bg-[#252526] p-2 focus-within:border-[#6b5cd1]/55 focus-within:ring-1 focus-within:ring-[#6b5cd1]/25"
            >
              {suggestOpen && (typeaheadLoading || elasticHits.length > 0) && (
                <div
                  className="absolute bottom-full left-0 right-10 z-40 mb-1 max-h-[min(220px,32vh)] overflow-y-auto rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] py-1 shadow-xl"
                  role="listbox"
                  aria-label="Company search matches"
                >
                  {typeaheadLoading && elasticHits.length === 0 ? (
                    <div className="px-3 py-2 font-mono text-[11px] text-[#6e6e6e]">Searching…</div>
                  ) : null}
                  {elasticHits.map((hit, idx) => {
                    const sym = hit.source?.symbol || "—";
                    const name = stripParentheticals(hit.source?.company_name || "");
                    const active = idx === suggestHighlight;
                    return (
                      <button
                        key={`${hit.id ?? sym}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition ${
                          active ? "bg-[#6b5cd1]/25 text-[#e8e0ff]" : "text-[#cccccc] hover:bg-[#2d2d2d]"
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setSuggestHighlight(idx)}
                        onClick={() => applyElasticPick(hit)}
                      >
                        <span className="font-mono text-[12px] font-semibold tracking-wide">{sym}</span>
                        {name ? (
                          <span className="line-clamp-2 text-[11px] text-[#8b8b8b]">{name}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              <textarea
                rows={1}
                className="max-h-32 min-h-[40px] w-full resize-none bg-transparent px-1 py-2 font-mono text-[13px] text-[#cccccc] placeholder:text-[#6e6e6e] outline-none"
                placeholder={
                  isAutoFocus
                    ? "Type ticker or company — local suggestions (IndexedDB) above; Enter to send"
                    : scope === "news"
                      ? "Keyword or company — local suggestions above; Enter for headlines"
                      : scope === "companies"
                        ? "Company or ticker — local suggestions above; Enter to search"
                        : "Type message — local company suggestions when searching names/tickers"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  const panelActive =
                    suggestOpen && (typeaheadLoading || elasticHits.length > 0);
                  if (e.key === "ArrowDown" && panelActive && elasticHits.length > 0) {
                    e.preventDefault();
                    setSuggestHighlight((i) => (i < 0 ? 0 : Math.min(i + 1, elasticHits.length - 1)));
                    return;
                  }
                  if (e.key === "ArrowUp" && panelActive && elasticHits.length > 0) {
                    e.preventDefault();
                    setSuggestHighlight((i) => Math.max(i - 1, -1));
                    return;
                  }
                  if (e.key === "Escape" && panelActive) {
                    e.preventDefault();
                    setSuggestOpen(false);
                    setElasticHits([]);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (panelActive && elasticHits.length > 0 && suggestHighlight >= 0) {
                      e.preventDefault();
                      applyElasticPick(elasticHits[suggestHighlight]);
                      return;
                    }
                    e.preventDefault();
                    if (canSend) void sendMessage();
                  }
                }}
              />
              <button
                type="button"
                title="Send"
                disabled={!canSend}
                onClick={() => void sendMessage()}
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#6b5cd1] text-white transition enabled:hover:bg-[#7c6dd8] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <p className="mt-2 px-0.5 text-center font-mono text-[10px] text-[#5a5a5a]">
              Session only — messages are not saved
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
