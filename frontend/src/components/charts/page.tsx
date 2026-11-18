/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { InstrumentService } from "@/src/services/Instrument.service";
import SelectDropdown from "@/src/sections/Dropdown";
import LightChart from "./LightChart";
import PositionsPanel from "@/src/components/trading/PositionsPanel";
import TradingSummaryPanel from "@/src/components/trading/TradingSummaryPanel";
import { useTradeSummary } from "@/src/hooks/useTradeSummary";
import AddToWatchlistButton from "@/src/components/watchlist/AddToWatchlistButton";
import { usePositions } from "@/src/hooks/usePositions";
import { Instrument } from "@/src/types/Instrument";
import { get, set } from "idb-keyval";
import { IDB_KEYS } from "@/src/libs/idbKeys";
import { isDemoDevMode } from "@/src/libs/devMode";
import { SimpleSocket } from "@/src/libs/socket";
import { CompanyService } from "@/src/services/Company.service";
import { stripParentheticals } from "@/src/libs/displayString";
import type { PaperTradingSnapshot } from "@/src/components/paperTrading/paperTradingTypes";
import { useAuth, readHasTradingSession } from "@/src/hooks/useAuth";
import TradingSignInPrompt from "@/src/components/trading/TradingSignInPrompt";

export type TradingChartPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TradingChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
};

type TF = TradingChartPeriod;

export type TradingChartMarketData = {
  symbol: string;
  period: TradingChartPeriod;
  candles: TradingChartCandle[];
  realtimeCandle: TradingChartCandle | null;
  realtimeQuoteAt: number | null;
  realtimeQuoteStale: boolean;
  persistedLastBarAt: number | null;
  loading: boolean;
  error: string | null;
};

interface TradingChartProps {
  defaultSymbol?: string;
  isFixed?: boolean;
  /** Lock to one symbol (company profile). Hides instrument picker. */
  lockSymbol?: string;
  /** Sync period from parent when locked (e.g. profile tabs). */
  controlledPeriod?: TF;
  /** Hide top toolbar (instrument / period / indicators). */
  hideToolbar?: boolean;
  /** Hide open-positions sidebar. */
  hidePositionsPanel?: boolean;
  /** Fill parent card instead of full dashboard shell. */
  embed?: boolean;
  onPaperTradingChange?: (snapshot: PaperTradingSnapshot) => void;
  /** Emits the exact persisted + realtime series rendered by this chart. */
  onMarketDataChange?: (state: TradingChartMarketData) => void;
}

type InstrumentLike = Instrument & {
  id: string | number;
  symbol: string;
  name?: string;
  company_name?: string;
};

const FIXED_PERIODS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const INDICATOR_OPTIONS = [
  { id: "ema20", label: "EMA 20" },
  { id: "ema50", label: "EMA 50" },
  { id: "ema100", label: "EMA 100" },
  { id: "sma20", label: "SMA 20" },
  { id: "sma50", label: "SMA 50" },
  { id: "macd", label: "MACD" },
  { id: "rsi", label: "RSI" },
  { id: "stochastic", label: "Stochastic" },
  { id: "bollinger", label: "Bollinger Bands" },
];

function getInstrumentDisplayName(item: Partial<InstrumentLike> | null | undefined) {
  if (!item) return "";
  const raw = item.name || item.company_name || item.symbol || "Unknown";
  return stripParentheticals(raw) || String(item.symbol || "Unknown");
}

function normalizeInstrument(item: any, index = 0): InstrumentLike {
  const sym = item?.symbol ?? "";
  const rawName = item?.name || item?.company_name || sym || "Unknown";
  const display = stripParentheticals(rawName) || sym || "Unknown";
  return {
    ...item,
    id: item?.id ?? item?._id ?? item?.symbol ?? `instrument-${index}`,
    symbol: sym,
    name: display,
    company_name: display,
  };
}

function normalizeInstrumentList(list: any[]): InstrumentLike[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => normalizeInstrument(item, index))
    .filter((item) => !!item.symbol);
}

function getPeriodBucketMs(rawTs: number | string | Date, period: TF): number | null {
  let date: Date;

  if (rawTs instanceof Date) {
    date = new Date(rawTs.getTime());
  } else if (typeof rawTs === "number") {
    date = new Date(rawTs < 10_000_000_000 ? rawTs * 1000 : rawTs);
  } else {
    const str = String(rawTs);
    date = str.includes("T")
      ? new Date(str)
      : new Date(str.replace(" ", "T") + "Z");
  }

  if (Number.isNaN(date.getTime())) return null;

  if (period === "daily") {
    date.setUTCHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    const day = date.getUTCDay() || 7; // Sunday => 7
    date.setUTCDate(date.getUTCDate() - day + 1); // Monday
    date.setUTCHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else if (period === "yearly") {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.getTime();
}

function normalizeCandles(list: any[], period: TF): TradingChartCandle[] {
  const uniqueMap = new Map<number, TradingChartCandle>();

  list
    .filter((d: any) => d.timestamp || d.timestamps || d.time)
    .forEach((d: any) => {
      const rawTs = d.timestamp || d.timestamps || d.time;
      const time = getPeriodBucketMs(rawTs, period);
      if (time === null) return;

      const next = {
        time,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume || 0),
      };

      const prev = uniqueMap.get(time);
      if (!prev) {
        uniqueMap.set(time, next);
      } else {
        uniqueMap.set(time, {
          time,
          open: Number(prev.open),
          high: Math.max(Number(prev.high), Number(next.high)),
          low: Math.min(Number(prev.low), Number(next.low)),
          close: Number(next.close),
          volume: Number(prev.volume || 0) + Number(next.volume || 0),
        });
      }
    });

  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
}

function mergeCandles(prev: TradingChartCandle[], next: TradingChartCandle[]) {
  const map = new Map<number, TradingChartCandle>();

  [...prev, ...next].forEach((c) => {
    if (!c?.time) return;
    map.set(Number(c.time), c);
  });

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function buildRealtimeBucketCandle({
  price,
  volume,
  rawTs,
  period,
  previousRealtime,
  latestHistorical,
  currentCandleFromDB,
  symbol,
}: {
  price: number;
  volume?: number;
  rawTs: number;
  period: TF;
  previousRealtime: TradingChartCandle | null;
  latestHistorical: TradingChartCandle | null;
  /** Current period candle from DB (initial_quote) - open price to avoid gap */
  currentCandleFromDB: TradingChartCandle | null;
  symbol: string;
}) {
  const bucketTime = getPeriodBucketMs(rawTs, period);
  if (bucketTime === null) return null;

  const sameRealtimeBucket =
    previousRealtime && Number(previousRealtime.time) === Number(bucketTime)
      ? previousRealtime
      : null;

  const sameHistoricalBucket =
    latestHistorical && Number(latestHistorical.time) === Number(bucketTime)
      ? latestHistorical
      : null;

  const sameDbBucket =
    currentCandleFromDB && Number(currentCandleFromDB.time) === Number(bucketTime)
      ? currentCandleFromDB
      : null;

  const base = sameRealtimeBucket || sameDbBucket || sameHistoricalBucket;

  if (!base) {
    return {
      symbol,
      time: bucketTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: volume != null && volume > 0 ? volume : 0,
    };
  }

  const baseVol = Number(base.volume || 0);
  const vol = volume != null && volume > 0 ? volume : baseVol;

  return {
    symbol,
    time: bucketTime,
    open: Number(base.open ?? price),
    high: Math.max(Number(base.high ?? price), price),
    low: Math.min(Number(base.low ?? price), price),
    close: price,
    volume: vol,
  };
}

export default function TradingChart({
  defaultSymbol = "AAPL",
  isFixed = false,
  lockSymbol,
  controlledPeriod,
  hideToolbar = false,
  hidePositionsPanel = false,
  embed = false,
  onPaperTradingChange,
  onMarketDataChange,
}: TradingChartProps) {
  const [instruments, setInstruments] = useState<InstrumentLike[]>([]);
  const [candles, setCandles] = useState<TradingChartCandle[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<TradingChartCandle | null>(null);
  const [realtimeQuoteAt, setRealtimeQuoteAt] = useState<number | null>(null);
  const [realtimeQuoteStale, setRealtimeQuoteStale] = useState(false);

  const [selectedInstrument, setSelectedInstrument] =
    useState<InstrumentLike | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const [, setCandlePage] = useState(1);
  const [hasMoreCandles, setHasMoreCandles] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  const { isChecking } = useAuth();
  const { positions, loading: positionsLoading, error: positionsError, refetch: refetchPositions, closePosition } = usePositions();

  const canTrade = !isChecking && readHasTradingSession();

  const selectedSymbol = selectedInstrument?.symbol?.toUpperCase() ?? "";
  const activeSymbol = (lockSymbol || selectedSymbol || defaultSymbol).toUpperCase();
  const realtimeClose = realtimeCandle?.close;

  const currentPriceBySymbol = useMemo(
    () =>
      activeSymbol && realtimeClose != null
        ? { [activeSymbol]: Number(realtimeClose) }
        : undefined,
    [activeSymbol, realtimeClose]
  );

  const {
    stats: tradeSummary,
    loading: tradeSummaryLoading,
    error: tradeSummaryError,
    refresh: refreshTradeSummary,
  } = useTradeSummary(positions, currentPriceBySymbol);

  const symbolPositions = useMemo(
    () =>
      positions
        .filter((p) => (p.symbol || "").toUpperCase() === activeSymbol)
        .map((p) => ({
          id: p.id,
          type: p.type,
          volume: p.volume,
          price: p.price,
          leverage: p.leverage,
          created_at: p.created_at,
          open: p.open,
        })),
    [positions, activeSymbol],
  );

  useEffect(() => {
    if (!lockSymbol) return;
    const frame = window.requestAnimationFrame(() => {
      setSelectedInstrument(normalizeInstrument({ symbol: lockSymbol.toUpperCase() }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lockSymbol]);

  useEffect(() => {
    if (!controlledPeriod) return;
    const frame = window.requestAnimationFrame(() => setSelectedPeriod(controlledPeriod));
    return () => window.cancelAnimationFrame(frame);
  }, [controlledPeriod]);

  const loadingMoreCandlesRef = useRef(false);
  const candlePageRef = useRef(1);
  const requestKeyRef = useRef(0);
  const candlesRef = useRef<TradingChartCandle[]>([]);
  const currentCandleFromDBRef = useRef<TradingChartCandle | null>(null);

  const PAGE_SIZE = 1000;

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    if (!onMarketDataChange) return;
    onMarketDataChange({
      symbol: activeSymbol,
      period: selectedPeriod,
      candles,
      realtimeCandle,
      realtimeQuoteAt,
      realtimeQuoteStale,
      persistedLastBarAt: candles.length ? Number(candles[candles.length - 1]?.time) : null,
      loading: loadingChart,
      error: chartError,
    });
  }, [
    activeSymbol,
    selectedPeriod,
    candles,
    realtimeCandle,
    realtimeQuoteAt,
    realtimeQuoteStale,
    loadingChart,
    chartError,
    onMarketDataChange,
  ]);

  const loadCandlePage = useCallback(
    async ({
      symbol,
      periodType,
      page,
      replace,
    }: {
      symbol: string;
      periodType: TF;
      page: number;
      replace: boolean;
    }) => {
      const requestKey = ++requestKeyRef.current;

      const raw = await InstrumentService.getInstrumentData(
        symbol,
        periodType,
        PAGE_SIZE,
        page
      );

      if (requestKey !== requestKeyRef.current) return [];

      const formatted = normalizeCandles(raw || [], periodType);

      setHasMoreCandles((raw || []).length === PAGE_SIZE);
      setCandlePage(page);
      candlePageRef.current = page;

      if (replace) {
        setCandles(formatted);
      } else {
        setCandles((prev) => mergeCandles(prev, formatted));
      }

      return formatted;
    },
    []
  );

  useEffect(() => {
    if (lockSymbol) return;
    const loadInstruments = async () => {
      try {
        const instrumentsCacheKey = isDemoDevMode()
          ? IDB_KEYS.INSTRUMENTS_DEMO
          : IDB_KEYS.INSTRUMENTS;
        const cached = await get(instrumentsCacheKey);

        if (Array.isArray(cached) && cached.length > 0) {
          const normalizedCached = normalizeInstrumentList(cached);

          setInstruments(normalizedCached);

          const preferred =
            normalizedCached.find((i) => i.symbol === defaultSymbol) ||
            normalizedCached.find((i) => i.symbol === "AAPL") ||
            normalizedCached[0] ||
            null;

          setSelectedInstrument(preferred);
          return;
        }

        const res = await CompanyService.getCompanies(isDemoDevMode() ? 50 : 30000, 1, [
          "symbol",
          "company_name",
        ]);

        const normalizedRes = normalizeInstrumentList(res || []);

        setInstruments(normalizedRes);
        await set(instrumentsCacheKey, normalizedRes);

        const preferred =
          normalizedRes.find((i) => i.symbol === defaultSymbol) ||
          normalizedRes.find((i) => i.symbol === "AAPL") ||
          normalizedRes[0] ||
          null;

        setSelectedInstrument(preferred);
      } catch (err) {
        console.error("Failed to load instruments:", err);
      }
    };

    loadInstruments();
  }, [defaultSymbol, lockSymbol]);

  useEffect(() => {
    if (!selectedSymbol) return;

    let cancelled = false;
    requestKeyRef.current += 1;
    candlePageRef.current = 1;
    loadingMoreCandlesRef.current = false;

    const startFrame = window.requestAnimationFrame(() => {
      setLoadingChart(true);
      setChartError(null);
      setCandles([]);
      setRealtimeCandle(null);
      setRealtimeQuoteAt(null);
      setRealtimeQuoteStale(false);
      setHasMoreCandles(true);
      setCandlePage(1);

      void loadCandlePage({
        symbol: selectedSymbol,
        periodType: selectedPeriod,
        page: 1,
        replace: true,
      })
        .then((formatted) => {
          if (cancelled) return;
          if (!formatted || formatted.length === 0) {
            setChartError(`No candle data for ${selectedSymbol}`);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Initial candle load error:", error);
          setChartError("Failed to load candle data");
        })
        .finally(() => {
          if (!cancelled) setLoadingChart(false);
        });
    });

    return () => {
      cancelled = true;
      requestKeyRef.current += 1;
      window.cancelAnimationFrame(startFrame);
    };
  }, [selectedSymbol, selectedPeriod, loadCandlePage]);

  const loadMoreCandles = useCallback(() => {
    if (!selectedSymbol) return;
    if (loadingMoreCandlesRef.current) return;
    if (!hasMoreCandles) return;

    loadingMoreCandlesRef.current = true;

    const nextPage = candlePageRef.current + 1;

    loadCandlePage({
      symbol: selectedSymbol,
      periodType: selectedPeriod,
      page: nextPage,
      replace: false,
    }).finally(() => {
      loadingMoreCandlesRef.current = false;
    });
  }, [selectedSymbol, selectedPeriod, hasMoreCandles, loadCandlePage]);

  useEffect(() => {
    if (!selectedSymbol) return;

    currentCandleFromDBRef.current = null;

    const socket = new SimpleSocket((data) => {
      const msg = data as {
        type?: string;
        symbol?: string;
        current_candle?: TradingChartCandle;
        price?: unknown;
        quote_ts?: unknown;
        quote_stale?: boolean;
      };
      const sym = msg.symbol;

      if (msg.type === "initial_quote") {
        if (sym !== selectedSymbol) return;

        if (msg.current_candle) {
          currentCandleFromDBRef.current = msg.current_candle;
        }

        const initialPrice = Number(msg.price);
        const initialQuoteTs = Number(msg.quote_ts);
        const hasFreshQuote =
          Number.isFinite(initialPrice) &&
          initialPrice > 0 &&
          Number.isFinite(initialQuoteTs) &&
          initialQuoteTs > 0;

        if (hasFreshQuote) {
          setRealtimeQuoteAt(initialQuoteTs);
          setRealtimeQuoteStale(msg.quote_stale === true);
          setRealtimeCandle((prev) => {
            const currentCandles = candlesRef.current;
            const latestHistorical = currentCandles.length
              ? currentCandles[currentCandles.length - 1]
              : null;
            return buildRealtimeBucketCandle({
              price: initialPrice,
              rawTs: initialQuoteTs,
              period: selectedPeriod,
              previousRealtime: prev,
              latestHistorical,
              currentCandleFromDB: currentCandleFromDBRef.current,
              symbol: selectedSymbol,
            });
          });
        }
        return;
      }

      if (msg.type !== "quote") return;
      if (sym !== selectedSymbol) return;

      const price = Number((data as { price: number }).price);
      const volume = Number((data as { volume?: number }).volume) || undefined;
      const ts = Number((data as { ts?: number }).ts || Date.now());

      if (!Number.isFinite(price) || price <= 0) return;

      setRealtimeQuoteAt(ts);
      setRealtimeQuoteStale(false);
      setRealtimeCandle((prev) => {
        const currentCandles = candlesRef.current;
        const latestHistorical =
          Array.isArray(currentCandles) && currentCandles.length > 0
            ? currentCandles[currentCandles.length - 1]
            : null;

        return buildRealtimeBucketCandle({
          price,
          volume,
          rawTs: ts,
          period: selectedPeriod,
          previousRealtime: prev,
          latestHistorical,
          currentCandleFromDB: currentCandleFromDBRef.current,
          symbol: selectedSymbol,
        });
      });
    });

    socket.connect();

    const timer = setTimeout(() => {
      socket.send({
        type: "subscribe",
        symbols: [selectedSymbol],
        period: selectedPeriod,
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      socket.disconnect();
      setRealtimeCandle(null);
      setRealtimeQuoteAt(null);
      setRealtimeQuoteStale(false);
      currentCandleFromDBRef.current = null;
    };
  }, [selectedSymbol, selectedPeriod]);

  const onToggleIndicator = (item: { id: string; label: string }) => {
    setSelectedIndicators((prev) => {
      if (item.id === "macd") {
        const hasMacdPair = prev.includes("ema20") && prev.includes("ema100");
        if (hasMacdPair) {
          return prev.filter((id) => id !== "ema20" && id !== "ema100" && id !== "macd");
        }
        return Array.from(new Set([...prev.filter((id) => id !== "macd"), "ema20", "ema100"]));
      }

      return prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id];
    });
  };

  const selectedIndicatorMenuIds = useMemo(() => {
    const ids = new Set(selectedIndicators);
    if (ids.has("ema20") && ids.has("ema100")) ids.add("macd");
    return Array.from(ids);
  }, [selectedIndicators]);

  const expandedInstrumentOptions = useMemo(() => {
    if (lockSymbol) {
      return [
        {
          id: activeSymbol,
          label: `${activeSymbol} - ${getInstrumentDisplayName(selectedInstrument) || activeSymbol}`,
        },
      ];
    }

    return instruments.map((i) => ({
      id: String(i.id),
      label: `${i.symbol} - ${getInstrumentDisplayName(i)}`,
    }));
  }, [activeSymbol, instruments, lockSymbol, selectedInstrument]);

  const selectedInstrumentOption = selectedInstrument
    ? {
        id: String(selectedInstrument.id),
        label: `${selectedInstrument.symbol} - ${getInstrumentDisplayName(selectedInstrument)}`,
      }
    : {
        id: activeSymbol,
        label: `${activeSymbol} - ${activeSymbol}`,
      };

  const expandedChartToolbar = (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <SelectDropdown
        portalMenu
        searchable={!lockSymbol}
        maxRender={200}
        className="w-[min(18rem,calc(100vw-7rem))]"
        options={expandedInstrumentOptions}
        selected={selectedInstrumentOption}
        placeholder="Select instrument"
        onSelect={(v) => {
          if (lockSymbol) return;
          const found = instruments.find((i) => String(i.id) === String(v.id));
          setSelectedInstrument(found || null);
        }}
      />

      <SelectDropdown
        portalMenu
        className="w-32"
        options={FIXED_PERIODS}
        selected={{
          id: selectedPeriod,
          label:
            FIXED_PERIODS.find((p) => p.id === selectedPeriod)?.label ||
            selectedPeriod,
        }}
        placeholder="Select period"
        onSelect={(v) => {
          setSelectedPeriod(v.id as TF);
        }}
      />

      <SelectDropdown
        portalMenu
        className="w-48"
        options={INDICATOR_OPTIONS}
        selectedIds={selectedIndicatorMenuIds}
        selected={
          selectedIndicators.length > 0
            ? {
                id: "multi",
                label: `Indicators (${selectedIndicators.length})`,
              }
            : null
        }
        placeholder="Add Indicators"
        onSelect={(v) =>
          onToggleIndicator(v as { id: string; label: string })
        }
      />

      {selectedIndicators.length > 0 ? (
        <button
          type="button"
          onClick={() => setSelectedIndicators([])}
          className="rounded-[var(--dsa-radius-sm)] px-2 py-1 text-[11px] font-medium text-[var(--dsa-negative)] hover:bg-[rgba(231,91,100,0.1)]"
        >
          Clear All
        </button>
      ) : null}
    </div>
  );

  const shellClass = embed
    ? "flex h-full min-h-0 w-full flex-col overflow-hidden"
    : "flex h-full w-full flex-col overflow-hidden bg-[var(--dsa-bg)]";

  return (
    <div className={shellClass}>
      {!isFixed && !hideToolbar && !lockSymbol && (
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-2 py-1.5">
          <SelectDropdown
            searchable
            maxRender={200}
            options={instruments.map((i) => ({
              id: i.id,
              label: `${i.symbol} - ${getInstrumentDisplayName(i)}`,
            }))}
            selected={
              selectedInstrument
                ? {
                    id: selectedInstrument.id,
                    label: `${selectedInstrument.symbol} - ${getInstrumentDisplayName(
                      selectedInstrument
                    )}`,
                  }
                : null
            }
            placeholder="Select instrument"
            onSelect={(v) => {
              const found = instruments.find((i) => String(i.id) === String(v.id));
              setSelectedInstrument(found || null);
            }}
          />

          <SelectDropdown
            options={FIXED_PERIODS}
            selected={{
              id: selectedPeriod,
              label:
                FIXED_PERIODS.find((p) => p.id === selectedPeriod)?.label ||
                selectedPeriod,
            }}
            placeholder="Select period"
            onSelect={(v) => {
              setSelectedPeriod(v.id as TF);
            }}
          />

          <div className="flex items-center gap-2">
            <SelectDropdown
              options={INDICATOR_OPTIONS}
              selectedIds={selectedIndicatorMenuIds}
              selected={
                selectedIndicators.length > 0
                  ? {
                      id: "multi",
                      label: `Indicators (${selectedIndicators.length})`,
                    }
                  : null
              }
              placeholder="Add Indicators"
              onSelect={(v) =>
                onToggleIndicator(v as { id: string; label: string })
              }
            />

            {selectedIndicators.length > 0 && (
              <button
                onClick={() => setSelectedIndicators([])}
                className="rounded-[var(--dsa-radius-sm)] px-2 py-1 text-[11px] text-[var(--dsa-negative)] transition-colors hover:bg-[rgba(231,91,100,0.1)]"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 w-full flex-1 flex-col gap-2 laptop:flex-row laptop:gap-3">
        <div className="relative min-h-[240px] min-w-0 flex-1 phone:min-h-[280px]">
          {isFixed && (
            <div className="absolute left-2 top-2 z-10 rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1 font-mono text-[10px] font-semibold uppercase text-white">
              {selectedInstrument?.symbol || defaultSymbol}
            </div>
          )}
          <div className="absolute top-2 right-2 z-10">
            <AddToWatchlistButton symbol={selectedInstrument?.symbol || defaultSymbol} />
          </div>

          {loadingChart ? (
            <div className="flex h-full items-center justify-center text-xs text-[var(--dsa-text-muted)]">
              Loading persisted price history…
            </div>
          ) : chartError ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--dsa-negative)]">
              {chartError}
            </div>
          ) : candles.length ? (
            <div className="h-full min-h-[220px] min-w-0">
              <LightChart
                symbol={activeSymbol}
                data={candles}
                realtimeCandle={realtimeCandle}
                onLoadMore={loadMoreCandles}
                period={selectedPeriod}
                indicators={selectedIndicators}
                showTrading={!isFixed && canTrade}
                positionsForSymbol={canTrade ? symbolPositions : []}
                onPaperTradingChange={canTrade ? onPaperTradingChange : undefined}
                expandedToolbar={expandedChartToolbar}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
              <span className="text-xs font-medium text-[var(--dsa-text-secondary)]">
                History unavailable for {selectedInstrument?.symbol || defaultSymbol}
              </span>
              <span className="text-[10px] text-[var(--dsa-text-muted)]">
                No persisted candle series is available for this timeframe.
              </span>
            </div>
          )}
        </div>

        {!isFixed && !hidePositionsPanel && (
          <aside className="flex w-full shrink-0 flex-col self-stretch laptop:w-72 laptop:max-w-[min(100%,22rem)] pc:w-80">
            {!canTrade ? (
              <TradingSignInPrompt className="w-full" compact />
            ) : (
              <div className="flex flex-col gap-3">
                <PositionsPanel
                  positions={positions}
                  loading={positionsLoading}
                  error={positionsError}
                  refetch={refetchPositions}
                  closePosition={closePosition}
                  currentPriceBySymbol={currentPriceBySymbol}
                />
                <TradingSummaryPanel
                  stats={tradeSummary}
                  loading={tradeSummaryLoading}
                  error={tradeSummaryError}
                  onRefresh={refreshTradeSummary}
                />
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
