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
  Sparkles,
} from "lucide-react";
import {
  CHATBOT_SCOPE_OPTIONS,
  CHATBOT_SCOPE_STORAGE_KEY,
  type ChatbotScopeId,
} from "@/src/constants/chatbotScope";

const ICONS: Record<ChatbotScopeId, ReactNode> = {
  analyze: <Sparkles className="text-amber-400" size={26} aria-hidden />,
  news: <Newspaper className="text-sky-400" size={26} aria-hidden />,
  companies: <Building2 className="text-emerald-400" size={26} aria-hidden />,
  analysis: <LineChart className="text-violet-400" size={26} aria-hidden />,
};

export default function ChatbotSelectPage() {
  const [selected, setSelected] = useState<ChatbotScopeId | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHATBOT_SCOPE_STORAGE_KEY);
      if (raw && CHATBOT_SCOPE_OPTIONS.some((o) => o.id === raw)) {
        setSelected(raw as ChatbotScopeId);
      }
    } catch {
      /* ignore */
    }
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
    <div className="min-h-screen bg-[#0b0e14] px-4 py-12 text-gray-200 phone:px-5 tablet:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex flex-col gap-4 border-b border-gray-800 pb-10">
          <div className="flex items-center gap-3 text-indigo-400">
            <MessageCircle size={28} aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wider">Assistant</span>
          </div>
          <h1 className="text-3xl font-bold text-white tablet:text-4xl">Choose a chat focus</h1>
          <p className="max-w-2xl text-gray-400">
            Pick one area so replies stay aligned with what you care about. You can change this anytime. Open the floating
            chat from any page after you select.
          </p>
          {selected && (
            <p className="text-sm text-indigo-300">
              Current focus:{" "}
              <span className="font-semibold text-white">
                {CHATBOT_SCOPE_OPTIONS.find((o) => o.id === selected)?.title}
              </span>
            </p>
          )}
        </div>

        <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2" role="list">
          {CHATBOT_SCOPE_OPTIONS.map((opt) => {
            const isActive = selected === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => persist(opt.id)}
                  className={`group relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border p-6 text-left transition-all ${
                    isActive
                      ? "border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-gray-800 bg-[#161a21] hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${
                        isActive ? "border-indigo-500/40 bg-[#0b0e14]" : "border-gray-800 bg-gray-900"
                      }`}
                    >
                      {ICONS[opt.id]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-white">{opt.title}</h2>
                      <p className="mt-1 text-sm text-gray-400">{opt.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-800/80 pt-4">
                    <span
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        isActive ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-300"
                      }`}
                    >
                      {isActive ? "Selected" : "Select"}
                    </span>
                    <Link
                      href={opt.href}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                    >
                      Go to section
                      <ChevronRight size={16} aria-hidden />
                    </Link>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center text-sm text-gray-500">
          Use the blue chat button at the bottom-right of the site to talk with the assistant.
        </p>
      </div>
    </div>
  );
}
