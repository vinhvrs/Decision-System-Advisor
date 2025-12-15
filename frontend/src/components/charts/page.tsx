/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { InstrumentService } from "@/src/services/Instrument.service";
import SelectDropdown from "../../sections/Dropdown";
import LightChart from "./LightChart";
import { Instrument } from "../../types/Instrument";
import { InstrumentPeriod } from "../../types/InstrumentPeriod";
import { createEcho } from "@/src/libs/echo";

/* ============================================================
 * HELPERS
 * ============================================================ */
function mapPeriodToTimeframe(period: string) {
  switch (period) {
    case "daily":
      return "daily";
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    case "yearly":
      return "yearly";
    default:
      return "daily";
  }
}

function normalizeCandles(
  list: any[],
  period: "daily" | "weekly" | "monthly" | "yearly"
) {
  const uniqueMap = new Map<number, any>();

  list
    .filter((d: any) => d.timestamp || d.timestamps)
    .forEach((d: any) => {
      const ts = d.timestamp || d.timestamps;

      // Ép UTC – rất quan trọng
      const date = new Date(ts.replace(" ", "T") + "Z");

      // ===== BUCKET TIME THEO PERIOD =====
      if (period === "daily") {
        date.setUTCHours(0, 0, 0, 0);
      }

      if (period === "weekly") {
        const day = date.getUTCDay() || 7; // CN = 7
        date.setUTCDate(date.getUTCDate() - day + 1); // Monday
        date.setUTCHours(0, 0, 0, 0);
      }

      if (period === "monthly") {
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
      }

      if (period === "yearly") {
        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
      }

      const time = Math.floor(new Date(ts.replace(" ", "T")).getTime());

      if (!uniqueMap.has(time)) {
        uniqueMap.set(time, {
          time,
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close),
        });
      }
    });

  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
}


/* ============================================================
 * PAGE
 * ============================================================ */
export default function InstrumentSelectionPage() {
  /** --------------------------------------------------------
   * FIXED DEFAULT AAPL
   ---------------------------------------------------------*/
  const AAPL_INSTRUMENT: Instrument = {
    id: "d094f426-1e91-4f3f-8ca0-e043a3a5d5e5",
    name: "Apple Inc.",
    symbol: "AAPL",
    type: "stock",
    exchange: "NASDAQ",
    slug: "apple-incaapl",
  };

  const AAPL_PERIODS: InstrumentPeriod[] = [
    { id: "67fa73bc-d17d-44f5-8fa0-f862b17c8334", instrument_id: AAPL_INSTRUMENT.id, period: "daily", type: "stock", prefix: "aapl" },
    { id: "ae6c7526-fea5-446f-a47d-18dd931d100f", instrument_id: AAPL_INSTRUMENT.id, period: "weekly", type: "stock", prefix: "aapl" },
    { id: "df543b05-4cd6-4eaf-9834-c97462d334d4", instrument_id: AAPL_INSTRUMENT.id, period: "monthly", type: "stock", prefix: "aapl" },
    { id: "0bb0ef82-519c-4ca8-81c0-ae1cd923296c", instrument_id: AAPL_INSTRUMENT.id, period: "yearly", type: "stock", prefix: "aapl" },
  ];

  /** --------------------------------------------------------
   * STATES
   ---------------------------------------------------------*/
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [periods, setPeriods] = useState<InstrumentPeriod[]>(AAPL_PERIODS);

  const [candles, setCandles] = useState<any[]>([]);
  const [candlePage, setCandlePage] = useState(1);

  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);
  const echoRef = useRef<any>(null);

  const [selectedInstrument, setSelectedInstrument] =
    useState<Instrument | null>(AAPL_INSTRUMENT);

  const [selectedPeriod, setSelectedPeriod] =
    useState<InstrumentPeriod | null>(AAPL_PERIODS[0]);

  const loadingMoreCandles = useRef(false);
  const throttleRef = useRef(0);

  /** --------------------------------------------------------
   * FETCH CANDLE PAGE
   ---------------------------------------------------------*/
  async function loadCandlePage(page: number) {
    try {
      const raw = await InstrumentService.getInstrumentDataByPeriod(
        selectedPeriod?.id || "",
        1000,
        page,
        ["timestamp", "timestamps", "open", "high", "low", "close"]
      );

      const formatted = normalizeCandles(raw, selectedPeriod?.period as any);

      if (page === 1) {
        setCandles(formatted);
      } else {
        setCandles((prev) => {
          const map = new Map<number, any>();

          // đưa prev vào trước
          prev.forEach((c) => {
            map.set(c.time, c);
          });

          // page mới (cũ hơn) override nếu trùng
          formatted.forEach((c) => {
            map.set(c.time, c);
          });

          return Array.from(map.values()).sort((a, b) => a.time - b.time);
        });

      }
    } catch (error) {
      console.error("Candle load error:", error);
    }
  }

  /** --------------------------------------------------------
   * INIT LOAD
   ---------------------------------------------------------*/
  useEffect(() => {
    loadCandlePage(1);
  }, []);

  /** --------------------------------------------------------
   * LOAD MORE
   ---------------------------------------------------------*/
  function loadMoreCandles() {
    const now = Date.now();
    if (now - throttleRef.current < 300) return;
    throttleRef.current = now;

    if (loadingMoreCandles.current) return;
    loadingMoreCandles.current = true;

    const nextPage = candlePage + 1;
    setCandlePage(nextPage);

    loadCandlePage(nextPage).finally(() => {
      loadingMoreCandles.current = false;
    });
  }

  /** --------------------------------------------------------
   * LOAD INSTRUMENTS
   ---------------------------------------------------------*/
  useEffect(() => {
    InstrumentService.getInstruments(30000, 1, ["id", "symbol", "name"])
      .then(setInstruments);
  }, []);

  /** --------------------------------------------------------
   * CHANGE STOCK
   ---------------------------------------------------------*/
  useEffect(() => {
    if (!selectedInstrument) return;

    async function loadPeriodsFn() {
      const fetched =
        selectedInstrument?.symbol === "AAPL"
          ? AAPL_PERIODS
          : await InstrumentService.getPeriodsById(selectedInstrument?.id ?? "");

      setPeriods(fetched);

      const daily = fetched.find((p) => p.period === "daily");
      setSelectedPeriod(daily || fetched[0] || null);

      resetCandles();
    }

    loadPeriodsFn();
  }, [selectedInstrument]);

  /** --------------------------------------------------------
   * RESET WHEN CHANGE PERIOD
   ---------------------------------------------------------*/
  function resetCandles() {
    setCandles([]);
    setRealtimeCandle(null);
    setCandlePage(1);
    setTimeout(() => loadCandlePage(1), 50);
  }

  useEffect(() => {
    if (!selectedPeriod) return;
    resetCandles();
  }, [selectedPeriod]);

  /** --------------------------------------------------------
   * REALTIME REVERB SUBSCRIBE
   ---------------------------------------------------------*/
  useEffect(() => {
  const echo = createEcho();
  if (!echo) return;

  echoRef.current = echo;

  const symbol = 'aapl';
  const period = 'daily';
  const channelName = `ohlc.${symbol}.${period}`;

  // ⬇️ ĐỢI SOCKET CONNECT
  const pusher = echo.connector.pusher;

  pusher.connection.bind('connected', () => {
    console.log('✅ Reverb connected');

    echo.channel(channelName).listen('.candle', (e: any) => {
      console.log('🔥 Realtime candle:', e.candle);
      setRealtimeCandle(e.candle);
    });

    console.log('📡 Subscribed to', channelName);
  });

  return () => {
    echo.leave(channelName);
    pusher.connection.unbind('connected');
  };
}, []);


  /** --------------------------------------------------------
   * UI
   ---------------------------------------------------------*/
  return (
    <main className="p-10 space-y-8">
      <h1 className="text-3xl font-bold">Market Chart</h1>

      <div className="flex gap-8">
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
          options={periods.map((p) => ({
            id: p.id,
            label: p.period,
          }))}
          selected={
            selectedPeriod
              ? { id: selectedPeriod.id, label: selectedPeriod.period }
              : null
          }
          placeholder="Select period"
          onSelect={(v) => {
            const found = periods.find((p) => p.id === v.id);
            setSelectedPeriod(found || null);
          }}
        />
      </div>

      <div className="mt-10">
        {candles.length ? (
          <LightChart
            symbol={selectedInstrument?.symbol || "AAPL"}
            data={candles}
            realtimeCandle={realtimeCandle}
            onLoadMore={loadMoreCandles}
          />
        ) : (
          <p className="text-gray-400 text-center py-10 text-lg">
            Loading chart...
          </p>
        )}
      </div>
    </main>
  );
}
