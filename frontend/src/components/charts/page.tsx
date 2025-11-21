/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { InstrumentService } from "@/src/services/Instrument.service";
import SelectDropdown from "../../sections/Dropdown";
import LightChart from "./LightChart";
import { Instrument } from "../../types/Instrument";
import { InstrumentPeriod } from "../../types/InstrumentPeriod";

export default function InstrumentSelectionPage() {
  /** --------------------------------------------
   * FIXED DEFAULT AAPL + PERIODS (3 periods)
   ---------------------------------------------*/
  const AAPL_INSTRUMENT: Instrument = {
    id: "d094f426-1e91-4f3f-8ca0-e043a3a5d5e5",
    name: "Apple Inc.",
    symbol: "AAPL",
    type: "stock",
    exchange: "NASDAQ",
    slug: "apple-incaapl",
  };

  const AAPL_PERIODS: InstrumentPeriod[] = [
    {
      id: "67fa73bc-d17d-44f5-8fa0-f862b17c8334",
      instrument_id: AAPL_INSTRUMENT.id,
      period: "daily",
      type: "stock",
      prefix: "aapl",
    },
    {
      id: "ae6c7526-fea5-446f-a47d-18dd931d100f",
      instrument_id: AAPL_INSTRUMENT.id,
      period: "weekly",
      type: "stock",
      prefix: "aapl",
    },
    {
      id: "df543b05-4cd6-4eaf-9834-c97462d334d4",
      instrument_id: AAPL_INSTRUMENT.id,
      period: "monthly",
      type: "stock",
      prefix: "aapl",
    },
  ];

  /** --------------------------------------------
   * STATES
   ---------------------------------------------*/
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [periods, setPeriods] = useState<InstrumentPeriod[]>(AAPL_PERIODS);

  const [candles, setCandles] = useState<
    { time: number; open: number; high: number; low: number; close: number }[]
  >([]);

  const [selectedInstrument, setSelectedInstrument] =
    useState<Instrument | null>(AAPL_INSTRUMENT);

  const [selectedPeriod, setSelectedPeriod] =
    useState<InstrumentPeriod | null>(AAPL_PERIODS[0]); // default DAILY

  /** --------------------------------------------
   * STEP 1 — FETCH AAPL DAILY FIRST (PRIORITY)
   ---------------------------------------------*/
  useEffect(() => {
    async function initDefault() {
      try {
        const list = (await InstrumentService.getInstrumentDataByPeriod(
          AAPL_PERIODS[0].id,
          100000,
          1,
          ["timestamp", "open", "high", "low", "close"]
        )) as any[];

        const formatted = list
          .filter((d: any) => d.timestamp)
          .map((d: any) => ({
            time: Math.floor(
              new Date(d.timestamp.replace(" ", "T")).getTime() / 1000
            ),
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
          }))
          .sort((a, b) => a.time - b.time);

        setCandles(formatted || []);
      } catch (err) {
        console.error("Error loading default AAPL chart:", err);
      }
    }

    initDefault();
  }, []);

  /** --------------------------------------------
   * STEP 2 — FETCH INSTRUMENT LIST AFTER CHART DONE
   ---------------------------------------------*/
  useEffect(() => {
    async function fetchInstruments() {
      const res = (await InstrumentService.getInstruments(
        30000,
        1,
        ["id", "name", "symbol"]
      )) as Instrument[];
      setInstruments(res);
    }
    fetchInstruments();
  }, []);

  /** --------------------------------------------
   * WHEN USER SELECTS ANOTHER INSTRUMENT → LOAD PERIODS
   ---------------------------------------------*/
  useEffect(() => {
    if (!selectedInstrument) return;

    async function loadPeriods() {
      if (selectedInstrument?.symbol === "AAPL") {
        setPeriods(AAPL_PERIODS);
        setSelectedPeriod(AAPL_PERIODS[0]);
        return;
      }

      const res = (await InstrumentService.getPeriodsById(
        selectedInstrument?.id || ""
      )) as InstrumentPeriod[];

      setPeriods(res);

      // Auto-set period = daily if available
      const daily = res.find((p) => p.period.toLowerCase() === "daily");
      setSelectedPeriod(daily || res[0] || null);
    }

    loadPeriods();
  }, [selectedInstrument]);

  /** --------------------------------------------
   * WHEN SELECTING PERIOD → FETCH CHART
   ---------------------------------------------*/
  useEffect(() => {
    if (!selectedPeriod) return;

    async function fetchCandleData() {
      const list = (await InstrumentService.getInstrumentDataByPeriod(
        selectedPeriod?.id || "",
        100000,
        1,
        ["timestamp", "open", "high", "low", "close"]
      )) as any[];

      const formatted = list
        .filter((d: any) => d.timestamp)
        .map((d: any) => ({
          time: Math.floor(
            new Date(d.timestamp.replace(" ", "T")).getTime() / 1000
          ),
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close),
        }))
        .sort((a, b) => a.time - b.time);

      setCandles(formatted || []);
    }

    fetchCandleData();
  }, [selectedPeriod]);

  /** --------------------------------------------
   * UI RENDER
   ---------------------------------------------*/
  return (
    <main className="p-10 space-y-8">
      <h1 className="text-3xl font-bold">Market Chart</h1>

      {/* DROPDOWNS */}
      <div className="flex gap-8">
        {/* INSTRUMENT DROPDOWN */}
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
          onSelect={(val) => {
            const found = instruments.find((i) => i.id === val.id);
            setSelectedInstrument(found || null);
            setCandles([]);
          }}
        />

        {/* PERIOD DROPDOWN */}
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
          onSelect={(val) => {
            const found = periods.find((p) => p.id === val.id);
            setSelectedPeriod(found || null);
          }}
        />
      </div>

      {/* CHART */}
      <div className="mt-10">
        {candles.length > 0 ? (
          <LightChart
            symbol={selectedInstrument?.symbol || "AAPL"}
            data={candles}
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
