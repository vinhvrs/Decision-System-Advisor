"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Building2,
  ChevronRight,
  LineChart,
  MessageCircle,
  Newspaper,
} from "lucide-react";
import {
  CHATBOT_SCOPE_OPTIONS,
  CHATBOT_SCOPE_STORAGE_KEY,
  type ChatbotScopeId,
} from "@/src/constants/chatbotScope";

const ICONS: Record<ChatbotScopeId, ReactNode> = {
  analyze: <BarChart3 className="text-[var(--dsa-warning)]" size={14} aria-hidden />,
  news: <Newspaper className="text-[#8ab4ff]" size={14} aria-hidden />,
  companies: <Building2 className="text-[var(--dsa-positive)]" size={14} aria-hidden />,
  analysis: <LineChart className="text-[#c4a3ff]" size={14} aria-hidden />,
};

export default function ChatbotSelectPage() {
  const [selected, setSelected] = useState<ChatbotScopeId | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(CHATBOT_SCOPE_STORAGE_KEY);
        if (raw && CHATBOT_SCOPE_OPTIONS.some((option) => option.id === raw)) {
          setSelected(raw as ChatbotScopeId);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = (id: ChatbotScopeId) => {
    setSelected(id);
    try {
      sessionStorage.setItem(CHATBOT_SCOPE_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
            <MessageCircle size={14} className="text-[#8ab4ff]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="dsa-section-label">Site chat</p>
            <h1 className="mt-0.5 truncate text-sm font-semibold text-white">Research focus</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="dsa-section-label">Current scope</p>
          <p className="mt-0.5 text-[10px] font-medium text-[#a9c7ff]">
            {selected ? CHATBOT_SCOPE_OPTIONS.find((option) => option.id === selected)?.title ?? "Selected" : "Not selected"}
          </p>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Purpose</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Constrain chat context</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Scopes</p>
          <p className="mt-1 font-mono text-xs text-white">{CHATBOT_SCOPE_OPTIONS.length}</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Persistence</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Current browser session</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Launch</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Floating chat control</p>
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Choose chat focus</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">
              A focus keeps replies aligned with the research surface you intend to use.
            </p>
          </div>
        </div>

        <div className="divide-y divide-[var(--dsa-border)]">
          {CHATBOT_SCOPE_OPTIONS.map((option) => {
            const active = selected === option.id;
            return (
              <div
                key={option.id}
                className={`grid min-w-0 gap-2 px-3 py-3 transition-colors phone:grid-cols-[32px_minmax(0,1fr)_auto] phone:items-center ${
                  active ? "bg-[var(--dsa-accent-soft)]" : "hover:bg-[var(--dsa-surface-2)]"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                  {ICONS[option.id]}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-white">{option.title}</p>
                    {active ? (
                      <span className="rounded-[var(--dsa-radius-sm)] border border-[rgba(76,141,255,0.3)] bg-[var(--dsa-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#a9c7ff]">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">{option.description}</p>
                </div>
                <div className="flex items-center gap-1.5 phone:justify-end">
                  <button
                    type="button"
                    onClick={() => persist(option.id)}
                    className={`min-h-7 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1 text-[10px] font-semibold ${
                      active
                        ? "border-[rgba(76,141,255,0.4)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                        : "border-[var(--dsa-border)] text-[var(--dsa-text-secondary)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                    }`}
                  >
                    {active ? "Selected" : "Select"}
                  </button>
                  <Link
                    href={option.href}
                    className="inline-flex min-h-7 items-center gap-1 rounded-[var(--dsa-radius-sm)] px-2 text-[10px] font-semibold text-[#8ab4ff] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                  >
                    Open
                    <ChevronRight size={12} aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="px-1 text-[10px] text-[var(--dsa-text-muted)]">
        Use the floating chat control after selecting a scope. Change the scope here whenever your research task changes.
      </p>
    </div>
  );
}
