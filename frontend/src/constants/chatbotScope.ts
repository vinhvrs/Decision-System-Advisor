/** Persisted focus for the site chatbot (sessionStorage). */
export const CHATBOT_SCOPE_STORAGE_KEY = "dsa-chatbot-scope";

export type ChatbotScopeId = "analyze" | "news" | "companies" | "analysis";

export type ChatbotScopeOption = {
  id: ChatbotScopeId;
  title: string;
  description: string;
  /** Related site area (browse while keeping the same chat focus). */
  href: string;
  /** Short label injected into outbound chat messages for the backend. */
  apiFocusLabel: string;
};

export const CHATBOT_SCOPE_OPTIONS: readonly ChatbotScopeOption[] = [
  {
    id: "analyze",
    title: "Results of analyze",
    description: "Rankings, recommendations, and market snapshot context.",
    href: "/",
    apiFocusLabel: "analyze results and recommendations",
  },
  {
    id: "news",
    title: "News",
    description: "Headlines, themes, and what moved the tape.",
    href: "/news",
    apiFocusLabel: "market news",
  },
  {
    id: "companies",
    title: "Company information",
    description: "Profiles, fundamentals, and symbol-level detail.",
    href: "/companies",
    apiFocusLabel: "company profiles and fundamentals",
  },
  {
    id: "analysis",
    title: "Indicators & Strategy",
    description: "Technical indicator lab and strategy playbooks with simulators.",
    href: "/indicators",
    apiFocusLabel: "technical indicators and trading strategies",
  },
] as const;
