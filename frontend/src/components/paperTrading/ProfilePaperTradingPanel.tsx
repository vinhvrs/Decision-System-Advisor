"use client";

import Link from "next/link";
import { useAuth } from "@/src/hooks/useAuth";
import type { PaperTradingSnapshot } from "./paperTradingTypes";

const CMC = {
  card: "bg-[#1e2329] border border-[#2b3139]",
  muted: "text-[#848e9c]",
  line: "border-[#2b3139]",
  green: "text-[#16c784]",
  red: "text-[#ea3943]",
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const ms = sec < 10_000_000_000 ? sec * 1000 : sec;
  try {
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

type Props = {
  symbol: string;
  state: PaperTradingSnapshot | null;
};

export default function ProfilePaperTradingPanel({ symbol, state }: Props) {
  const { isLoggedIn, isChecking } = useAuth();

  if (isChecking) return null;

  if (!isLoggedIn) {
    return (
      <div className={`rounded-xl ${CMC.card} p-4`}>
        <p className={`text-xs leading-relaxed ${CMC.muted}`}>
          <Link href="/auth/login" className="font-semibold text-[#7b9cff] hover:underline">
            Sign in
          </Link>{" "}
          for paper trading summary on {symbol}.
        </p>
      </div>
    );
  }

  const position = state?.position ?? { side: "flat" as const, qty: 0, avgPrice: 0 };
  const trades = state?.trades ?? [];
  const openTrades = trades.filter((t) => {
    if (position.side === "flat") return false;
    return (
      (position.side === "long" && t.side === "buy") ||
      (position.side === "short" && t.side === "sell")
    );
  });
  const history = [...trades].reverse().slice(0, 24);
  const uPnL = state?.unrealizedPnl ?? 0;
  const marketPrice = state?.marketPrice;

  return (
    <div className={`rounded-xl ${CMC.card} p-4`}>
      <p className={`mb-3 text-[10px] font-bold uppercase tracking-wider ${CMC.muted}`}>
        Paper trading · {symbol}
      </p>

      <div className={`mb-3 rounded-lg border ${CMC.line} bg-black/20 p-3`}>
        <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${CMC.muted}`}>
          Current position
        </p>
        {position.side === "flat" ? (
          <p className={`text-xs ${CMC.muted}`}>No open position</p>
        ) : (
          <div className="space-y-1 text-xs text-white">
            <div className="flex justify-between gap-2">
              <span className={CMC.muted}>Side</span>
              <span className="font-semibold uppercase">{position.side}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={CMC.muted}>Qty</span>
              <span className="font-mono">{position.qty}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className={CMC.muted}>Avg</span>
              <span className="font-mono">{position.avgPrice.toFixed(4)}</span>
            </div>
            {marketPrice != null && Number.isFinite(marketPrice) ? (
              <div className="flex justify-between gap-2">
                <span className={CMC.muted}>Mkt</span>
                <span className="font-mono">{marketPrice.toFixed(4)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <span className={CMC.muted}>uPnL</span>
              <span className={`font-mono font-semibold ${uPnL >= 0 ? CMC.green : CMC.red}`}>
                {uPnL >= 0 ? "+" : ""}
                {uPnL.toFixed(4)}
              </span>
            </div>
          </div>
        )}
      </div>

      {openTrades.length > 0 ? (
        <div className="mb-3">
          <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${CMC.muted}`}>
            Open orders
          </p>
          <ul
            className={`max-h-24 space-y-1 overflow-y-auto no-scrollbar rounded-lg border ${CMC.line} bg-black/15 p-2`}
          >
            {openTrades.slice(-6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-[10px]">
                <span className={t.side === "buy" ? CMC.green : CMC.red}>{t.side.toUpperCase()}</span>
                <span className="font-mono text-white">
                  {t.volume} @ {t.price.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${CMC.muted}`}>
          Trade history
        </p>
        {history.length === 0 ? (
          <p className={`text-xs ${CMC.muted}`}>No trades yet — use Buy/Sell on the chart.</p>
        ) : (
          <ul
            className={`max-h-40 space-y-1.5 overflow-y-auto no-scrollbar rounded-lg border ${CMC.line} bg-black/15 p-2`}
          >
            {history.map((t) => (
              <li key={t.id} className="border-b border-[#2b3139]/60 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className={`font-semibold ${t.side === "buy" ? CMC.green : CMC.red}`}>
                    {t.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-white">
                    {t.volume} × {t.leverage}L @ {t.price.toFixed(2)}
                  </span>
                </div>
                <p className={`mt-0.5 text-[9px] ${CMC.muted}`}>{formatTime(t.timeSec)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
