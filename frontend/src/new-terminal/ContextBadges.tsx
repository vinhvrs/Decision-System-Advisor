import type { ReactNode } from "react";

const currencyFlags: Record<string, { flag: string; country: string }> = {
  USD: { flag: "🇺🇸", country: "United States" },
  EUR: { flag: "🇪🇺", country: "Euro Area" },
  GBP: { flag: "🇬🇧", country: "United Kingdom" },
  JPY: { flag: "🇯🇵", country: "Japan" },
  CNY: { flag: "🇨🇳", country: "China" },
  CNH: { flag: "🇨🇳", country: "China" },
  CAD: { flag: "🇨🇦", country: "Canada" },
  AUD: { flag: "🇦🇺", country: "Australia" },
  NZD: { flag: "🇳🇿", country: "New Zealand" },
  CHF: { flag: "🇨🇭", country: "Switzerland" },
  HKD: { flag: "🇭🇰", country: "Hong Kong" },
  SGD: { flag: "🇸🇬", country: "Singapore" },
  INR: { flag: "🇮🇳", country: "India" },
  KRW: { flag: "🇰🇷", country: "South Korea" },
  MXN: { flag: "🇲🇽", country: "Mexico" },
  BRL: { flag: "🇧🇷", country: "Brazil" },
};

export function CurrencyContext({ currency }: { currency?: string | null }) {
  const code = (currency ?? "").toUpperCase();
  const info = currencyFlags[code];
  return (
    <span className="nt-context-badge" title={info ? info.country : code || "Currency unavailable"}>
      <span className="nt-context-icon">{info?.flag ?? "◌"}</span>
      <span>{code || "—"}</span>
    </span>
  );
}

function currencyFlag(code: string) {
  return currencyFlags[code]?.flag ?? "◌";
}

export function SymbolContext({ symbol }: { symbol?: string | null }) {
  const raw = (symbol ?? "").toUpperCase().trim();
  if (!raw) return <span className="nt-context-badge nt-context-muted"><span className="nt-context-icon">◌</span>GLOBAL</span>;

  if (raw.endsWith("=X") && raw.length >= 8) {
    const pair = raw.slice(0, 6);
    const base = pair.slice(0, 3);
    const quote = pair.slice(3, 6);
    return <span className="nt-context-badge" title="FX pair"><span className="nt-context-icon">{currencyFlag(base)}{currencyFlag(quote)}</span>{base}/{quote}</span>;
  }

  if (raw.endsWith("-USD")) {
    return <span className="nt-context-badge nt-context-crypto" title="Crypto / USD"><span className="nt-context-icon">₿</span>{raw.replace("-", "/")}</span>;
  }

  if (raw.endsWith("=F")) {
    return <span className="nt-context-badge nt-context-commodity" title="Futures / commodity"><span className="nt-context-icon">◇</span>{raw.replace("=F", "")}</span>;
  }

  if (raw.startsWith("^")) {
    return <span className="nt-context-badge nt-context-index" title="Market index"><span className="nt-context-icon">▦</span>{raw.slice(1)}</span>;
  }

  return <span className="nt-context-badge nt-context-equity" title="Tracked US equity"><span className="nt-context-icon">🇺🇸</span>{raw}</span>;
}

export function ImpactBadge({ impact }: { impact?: string | null }) {
  const normalized = (impact ?? "").trim().toLowerCase();
  const level = normalized.includes("high") ? "high" : normalized.includes("med") ? "medium" : normalized.includes("low") ? "low" : "unknown";
  const label = level === "high" ? "HIGH" : level === "medium" ? "MED" : level === "low" ? "LOW" : "—";
  return <span className={`nt-impact nt-impact-${level}`}><span className="nt-impact-dot" />{label}</span>;
}

export function SourceBadge({ children }: { children: ReactNode }) {
  return <span className="nt-source-badge">{children}</span>;
}
