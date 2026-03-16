/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { InstrumentService } from "@/src/services/Instrument.service";
import SelectDropdown from "@/src/sections/Dropdown";
import LightChart from "./LightChart";
import { Instrument } from "@/src/types/Instrument";
import { get, set } from "idb-keyval";
import { IDB_KEYS } from "@/src/libs/idbKeys";
import { SimpleSocket } from "@/src/libs/socket";
import { CompanyService } from "@/src/services/Company.service";

type TF = "daily" | "weekly" | "monthly" | "yearly";

interface TradingChartProps {
  defaultSymbol?: string;
  isFixed?: boolean;
}

type InstrumentLike = Instrument & {
  id: string | number;
  symbol: string;
  name?: string;
  company_name?: string;
};

const FIXED_PERIODS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
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
  return item.name || item.company_name || item.symbol || "Unknown";
}

function normalizeInstrument(item: any, index = 0): InstrumentLike {
  return {
    ...item,
    id: item?.id ?? item?._id ?? item?.symbol ?? `instrument-${index}`,
    symbol: item?.symbol ?? "",
    name: item?.name || item?.company_name || item?.symbol || "Unknown",
    company_name: item?.company_name || item?.name || item?.symbol || "Unknown",
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

function normalizeCandles(list: any[], period: TF) {
  const uniqueMap = new Map<number, any>();

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

      if (!uniqueMap.has(time)) {
        uniqueMap.set(time, next);
      } else {
        const prev = uniqueMap.get(time);
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

function mergeCandles(prev: any[], next: any[]) {
  const map = new Map<number, any>();

  [...prev, ...next].forEach((c) => {
    if (!c?.time) return;
    map.set(Number(c.time), c);
  });

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function buildRealtimeBucketCandle({
  price,
  rawTs,
  period,
  previousRealtime,
  latestHistorical,
  symbol,
}: {
  price: number;
  rawTs: number;
  period: TF;
  previousRealtime: any | null;
  latestHistorical: any | null;
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

  const base = sameRealtimeBucket || sameHistoricalBucket;

  if (!base) {
    return {
      symbol,
      time: bucketTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    };
  }

  return {
    symbol,
    time: bucketTime,
    open: Number(base.open ?? price),
    high: Math.max(Number(base.high ?? price), price),
    low: Math.min(Number(base.low ?? price), price),
    close: price,
    volume: Number(base.volume || 0),
  };
}

export default function TradingChart({
  defaultSymbol = "AAPL",
  isFixed = false,
}: TradingChartProps) {
  const [instruments, setInstruments] = useState<InstrumentLike[]>([]);
  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);

  const [selectedInstrument, setSelectedInstrument] =
    useState<InstrumentLike | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  const [candlePage, setCandlePage] = useState(1);
  const [hasMoreCandles, setHasMoreCandles] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  const loadingMoreCandlesRef = useRef(false);
  const candlePageRef = useRef(1);
  const requestKeyRef = useRef(0);
  const candlesRef = useRef<any[]>([]);

  const PAGE_SIZE = 1000;

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

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
    const loadInstruments = async () => {
      try {
        const cached = await get(IDB_KEYS.INSTRUMENTS);

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

        const res = await CompanyService.getCompanies(30000, 1, [
          "symbol",
          "company_name",
        ]);

        const normalizedRes = normalizeInstrumentList(res || []);

        setInstruments(normalizedRes);
        await set(IDB_KEYS.INSTRUMENTS, normalizedRes);

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
  }, [defaultSymbol]);

  useEffect(() => {
    if (!selectedInstrument?.symbol) return;

    setLoadingChart(true);
    setChartError(null);

    requestKeyRef.current += 1;
    setCandles([]);
    setRealtimeCandle(null);
    setHasMoreCandles(true);
    setCandlePage(1);
    candlePageRef.current = 1;
    loadingMoreCandlesRef.current = false;

    loadCandlePage({
      symbol: selectedInstrument.symbol,
      periodType: selectedPeriod,
      page: 1,
      replace: true,
    })
      .then((formatted) => {
        if (!formatted || formatted.length === 0) {
          setChartError(`No candle data for ${selectedInstrument.symbol}`);
        }
      })
      .catch((error) => {
        console.error("Initial candle load error:", error);
        setChartError("Failed to load candle data");
      })
      .finally(() => {
        setLoadingChart(false);
      });
  }, [selectedInstrument?.symbol, selectedPeriod, loadCandlePage]);

  const loadMoreCandles = useCallback(() => {
    if (!selectedInstrument?.symbol) return;
    if (loadingMoreCandlesRef.current) return;
    if (!hasMoreCandles) return;

    loadingMoreCandlesRef.current = true;

    const nextPage = candlePageRef.current + 1;

    loadCandlePage({
      symbol: selectedInstrument.symbol,
      periodType: selectedPeriod,
      page: nextPage,
      replace: false,
    }).finally(() => {
      loadingMoreCandlesRef.current = false;
    });
  }, [selectedInstrument?.symbol, selectedPeriod, hasMoreCandles, loadCandlePage]);

  useEffect(() => {
    if (!selectedInstrument?.symbol) return;

    const socket = new SimpleSocket((data) => {
      if ((data as { type?: string }).type !== "quote") return;
      if ((data as { symbol?: string }).symbol !== selectedInstrument.symbol) return;

      const price = Number((data as { price: number }).price);
      const ts = Number((data as { ts?: number }).ts || Date.now());

      if (!Number.isFinite(price) || price <= 0) return;

      setRealtimeCandle((prev: any) => {
        const currentCandles = candlesRef.current;
        const latestHistorical =
          Array.isArray(currentCandles) && currentCandles.length > 0
            ? currentCandles[currentCandles.length - 1]
            : null;

        return buildRealtimeBucketCandle({
          price,
          rawTs: ts,
          period: selectedPeriod,
          previousRealtime: prev,
          latestHistorical,
          symbol: selectedInstrument.symbol,
        });
      });
    });

    socket.connect();

    const timer = setTimeout(() => {
      socket.send({
        type: "subscribe",
        symbols: [selectedInstrument.symbol],
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      socket.disconnect();
      setRealtimeCandle(null);
    };
  }, [selectedInstrument?.symbol, selectedPeriod]);

  const onToggleIndicator = (item: { id: string; label: string }) => {
    setSelectedIndicators((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id]
    );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0B1220]">
      {!isFixed && (
        <div className="p-2 flex gap-4 border-b border-white/5 flex-none items-center">
          <SelectDropdown
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
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors underline"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 relative w-full h-full">
        {isFixed && (
          <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white uppercase border border-white/10">
            {selectedInstrument?.symbol || defaultSymbol}
          </div>
        )}

        {loadingChart ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading chart...
          </div>
        ) : chartError ? (
          <div className="flex items-center justify-center h-full text-red-400/80 text-sm">
            {chartError}
          </div>
        ) : candles.length ? (
          <LightChart
            symbol={selectedInstrument?.symbol || defaultSymbol}
            data={candles}
            realtimeCandle={realtimeCandle}
            onLoadMore={loadMoreCandles}
            period={selectedPeriod}
            indicators={selectedIndicators}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-yellow-400 text-sm">
            No candle data for {selectedInstrument?.symbol || defaultSymbol}
          </div>
        )}
      </div>
    </div>
  );
}