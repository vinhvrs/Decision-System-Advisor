/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { InstrumentService } from "@/src/services/Instrument.service";
import SelectDropdown from "../../sections/Dropdown";
import LightChart from "./LightChart";
import { Instrument } from "../../types/Instrument";
import { get, set } from "idb-keyval";
import { IDB_KEYS } from "@/src/libs/idbKeys";
import { SimpleSocket } from "@/src/libs/socket";

type TF = "daily" | "weekly" | "monthly" | "yearly";

interface TradingChartProps {
  defaultSymbol?: string;
  isFixed?: boolean;
}

const FIXED_PERIODS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "daily" },
  { id: "weekly", label: "weekly" },
  { id: "monthly", label: "monthly" },
  { id: "yearly", label: "yearly" },
];

function normalizeCandles(list: any[], period: TF) {
  const uniqueMap = new Map<number, any>();

  list
    .filter((d: any) => d.timestamp || d.timestamps || d.time)
    .forEach((d: any) => {
      const rawTs = d.timestamp || d.timestamps || d.time;
      let date: Date;

      if (typeof rawTs === "number") {
        date = new Date(rawTs < 10_000_000_000 ? rawTs * 1000 : rawTs);
      } else {
        const str = String(rawTs);
        date = str.includes("T")
          ? new Date(str)
          : new Date(str.replace(" ", "T") + "Z");
      }

      if (Number.isNaN(date.getTime())) return;

      if (period === "daily") {
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "weekly") {
        const day = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() - day + 1);
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "yearly") {
        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
      }

      const time = date.getTime();

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

export default function TradingChart({
  defaultSymbol = "AAPL",
  isFixed = false,
}: TradingChartProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);

  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");
  const [selectedIndicator, setSelectedIndicator] =
    useState<{ id: string; label: string } | null>(null);

  const [candlePage, setCandlePage] = useState(1);
  const [hasMoreCandles, setHasMoreCandles] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  const loadingMoreCandlesRef = useRef(false);
  const candlePageRef = useRef(1);
  const requestKeyRef = useRef(0);

  const PAGE_SIZE = 1000;

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
        setChartError(null);

        const cached = await get(IDB_KEYS.INSTRUMENTS);
        const list =
          cached?.length
            ? cached
            : await InstrumentService.getInstruments(30000, 1, [
                "id",
                "symbol",
                "name",
              ]);

        setInstruments(list);

        if (!cached?.length) {
          await set(IDB_KEYS.INSTRUMENTS, list);
        }

        const found = list.find((i: Instrument) => i.symbol === defaultSymbol);

        if (!found) {
          setChartError(`Instrument ${defaultSymbol} not found`);
          setSelectedInstrument(null);
          setLoadingChart(false);
          return;
        }

        setSelectedInstrument(found);
      } catch (err) {
        console.error("Instrument load error:", err);
        setChartError("Failed to load instruments");
        setLoadingChart(false);
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

    const socket = new SimpleSocket("ws://127.0.0.1:8000/ws/quotes", (data) => {
      if ((data as { type?: string }).type !== "quote") return;
      if ((data as { symbol?: string }).symbol !== selectedInstrument.symbol) return;

      const price = Number((data as { price: number }).price);

      setRealtimeCandle({
        symbol: selectedInstrument.symbol,
        time: (data as { ts: number }).ts,
        open: price,
        high: price,
        low: price,
        close: price,
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
  }, [selectedInstrument?.symbol]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {!isFixed && (
        <div className="p-2 flex gap-4 border-b border-white/5 text-black flex-none">
          <SelectDropdown
            options={instruments.map((i) => ({
              id: i.id,
              label: `${i.symbol} - ${i.name}`,
            }))}
            selected={
              selectedInstrument
                ? {
                    id: selectedInstrument.id,
                    label: `${selectedInstrument.symbol} - ${selectedInstrument.name}`,
                  }
                : null
            }
            placeholder="Select instrument"
            onSelect={(v) => {
              const found = instruments.find((i) => i.id === v.id);
              setSelectedInstrument(found || null);
            }}
          />

          <SelectDropdown
            options={FIXED_PERIODS}
            selected={{
              id: selectedPeriod,
              label: selectedPeriod,
            }}
            placeholder="Select period"
            onSelect={(v) => {
              setSelectedPeriod(v.id as TF);
            }}
          />

          <SelectDropdown
            options={[
              { id: "macd", label: "MACD" },
              { id: "rsi", label: "RSI" },
              { id: "stochastic", label: "Stochastic" },
              { id: "bollinger", label: "Bollinger Bands" },
            ]}
            selected={selectedIndicator}
            placeholder="Indicator"
            onSelect={(v) => {
              setSelectedIndicator(v as { id: string; label: string });
            }}
          />
        </div>
      )}

      <div className="flex-1 relative w-full h-full">
        {isFixed && (
          <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white uppercase border border-white/10">
            {selectedInstrument?.symbol || defaultSymbol}
          </div>
        )}

        {loadingChart ? (
          <p className="text-gray-400 text-center py-10 text-lg">Loading chart...</p>
        ) : chartError ? (
          <p className="text-red-400 text-center py-10 text-sm">{chartError}</p>
        ) : candles.length ? (
          <LightChart
            symbol={selectedInstrument?.symbol || defaultSymbol}
            data={candles}
            realtimeCandle={realtimeCandle}
            onLoadMore={loadMoreCandles}
            period={selectedPeriod}
          />
        ) : (
          <p className="text-yellow-400 text-center py-10 text-sm">
            No candle data for {selectedInstrument?.symbol || defaultSymbol}
          </p>
        )}
      </div>
    </div>
  );
}