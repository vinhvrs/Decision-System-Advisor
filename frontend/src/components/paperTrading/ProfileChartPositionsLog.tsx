"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { usePositions } from "@/src/hooks/usePositions";
import { useAuth } from "@/src/hooks/useAuth";
import { calcTicketProfit, formatOpenPnl } from "@/src/libs/tradingPnl";
import type { PaperTradingSnapshot } from "./paperTradingTypes";

const CMC = {
  muted: "text-[#848e9c]",
  line: "border-[#2b3139]",
  green: "text-[#16c784]",
  red: "text-[#ea3943]",
};

function formatOpened(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
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

function formatTimeSec(sec: number): string {
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
  paperState: PaperTradingSnapshot | null;
};

export default function ProfileChartPositionsLog({ symbol, paperState }: Props) {
  const { isLoggedIn, isChecking: authChecking } = useAuth();
  const { positions, loading, error, closePosition } = usePositions();
  const [closingId, setClosingId] = useState<string | null>(null);
  const sym = symbol.toUpperCase();

  const openTickets = useMemo(
    () => positions.filter((p) => (p.symbol || "").toUpperCase() === sym),
    [positions, sym],
  );

  const sessionTrades = isLoggedIn ? (paperState?.trades ?? []) : [];
  const history = [...sessionTrades].reverse();
  const marketPrice = paperState?.marketPrice ?? null;

  const handleClose = async (ticketId: string, ticketPrice: number) => {
    if (!isLoggedIn) return;
    setClosingId(ticketId);
    try {
      const px =
        marketPrice != null && Number.isFinite(marketPrice) ? marketPrice : ticketPrice;
      await closePosition(ticketId, px);
      window.dispatchEvent(new CustomEvent("ticket-changed"));
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className={`border-t ${CMC.line} px-3 py-3`}>
      <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${CMC.muted}`}>
        Positions log · {sym}
      </p>

      {authChecking ? (
        <div className={`flex items-center gap-2 py-2 text-xs ${CMC.muted}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking session…
        </div>
      ) : !isLoggedIn ? (
        <p className={`text-xs leading-relaxed ${CMC.muted}`}>
          <Link href="/auth/login" className="font-semibold text-[#7b9cff] hover:underline">
            Sign in
          </Link>{" "}
          to view open positions, close tickets, and use paper trading on this chart.
        </p>
      ) : (
        <>
          {loading && openTickets.length === 0 ? (
            <div className={`flex items-center gap-2 py-2 text-xs ${CMC.muted}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading open positions…
            </div>
          ) : null}

          {error && !String(error).includes("401") ? (
            <p className={`mb-2 text-xs text-[#ea3943]`}>{error}</p>
          ) : null}

          <div className={`overflow-x-auto rounded-lg border ${CMC.line} bg-black/20`}>
            <table className="w-full min-w-[480px] text-left text-[11px]">
              <thead>
                <tr className={`border-b ${CMC.line} ${CMC.muted}`}>
                  <th className="px-2 py-1.5 font-semibold">Side</th>
                  <th className="px-2 py-1.5 font-semibold">Volume</th>
                  <th className="px-2 py-1.5 font-semibold">Leverage</th>
                  <th className="px-2 py-1.5 font-semibold">Entry price</th>
                  <th className="px-2 py-1.5 font-semibold">Opened</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Unrealized profit</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Close</th>
                </tr>
              </thead>
              <tbody>
                {openTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-2 py-3 ${CMC.muted}`}>
                      No open tickets for {sym}.
                    </td>
                  </tr>
                ) : (
                  openTickets.map((p) => {
                    const isBuy = (p.type || "").toLowerCase() === "buy";
                    const openPrice = Number(p.price) || 0;
                    const vol = Number(p.volume) || 0;
                    const lev = Number(p.leverage) || 1;
                    const livePrice =
                      marketPrice != null && Number.isFinite(marketPrice)
                        ? marketPrice
                        : p.current_price != null
                          ? Number(p.current_price)
                          : null;
                    const pnl =
                      livePrice != null && Number.isFinite(livePrice)
                        ? calcTicketProfit(p.type, openPrice, livePrice, vol, lev)
                        : p.profit != null
                          ? Number(p.profit)
                          : null;
                    const pnlClass =
                      pnl == null ? CMC.muted : pnl >= 0 ? CMC.green : CMC.red;
                    const isClosing = closingId === p.id;
                    return (
                      <tr key={p.id} className={`border-b ${CMC.line}/60 last:border-0`}>
                        <td className={`px-2 py-1.5 font-semibold ${isBuy ? CMC.green : CMC.red}`}>
                          {p.type}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-white">{p.volume}</td>
                        <td className="px-2 py-1.5 font-mono text-white">{p.leverage ?? 1}</td>
                        <td className="px-2 py-1.5 font-mono text-white">{Number(p.price).toFixed(4)}</td>
                        <td className={`px-2 py-1.5 ${CMC.muted}`}>
                          {formatOpened(p.open || p.created_at)}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono font-semibold ${pnlClass}`}>
                          {formatOpenPnl(pnl)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={isClosing}
                            onClick={() => handleClose(p.id, Number(p.price))}
                            className="rounded bg-[#2b3139] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-[#3861fb] disabled:opacity-50"
                          >
                            {isClosing ? "…" : "Close"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {history.length > 0 ? (
            <div className="mt-3">
              <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${CMC.muted}`}>
                Session fills (this chart)
              </p>
              <ul
                className={`max-h-32 space-y-1 overflow-y-auto no-scrollbar rounded-lg border ${CMC.line} bg-black/15 p-2`}
              >
                {history.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className={t.side === "buy" ? CMC.green : CMC.red}>{t.side.toUpperCase()}</span>
                    <span className="font-mono text-white">
                      {t.volume} × {t.leverage}L @ {t.price.toFixed(4)}
                    </span>
                    <span className={CMC.muted}>{formatTimeSec(t.timeSec)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
