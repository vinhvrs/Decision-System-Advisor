"use client";

import WebSocket from "ws";
import protobuf from "protobufjs";
import axios from "axios";

// ===== CONFIG =====
const YAHOO_WSS = "wss://streamer.finance.yahoo.com";
const SYMBOLS = ["AAPL", "GOOG", "MSFT", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "DIS"];
const LARAVEL_ENDPOINT = "http://127.0.0.1:1111/api/market/tick";

// ===== LOAD PROTO =====
const root = protobuf.loadSync("./ticker.proto");
const Ticker = root.lookupType("Ticker");

// ===== LOGIC =====
const ONE_MINUTE = 60 * 1000;
const ohlcStore = new Map();

function toMinuteBucket(timestampMs) {
    return Math.floor(timestampMs / ONE_MINUTE) * ONE_MINUTE;
}

function toDateUTC(ms) {
    return new Date(ms);
}

function toDailyBucket(ms) {
    const d = toDateUTC(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function toWeeklyBucket(ms) {
    const d = toDateUTC(ms);
    const day = d.getUTCDay() || 7; // CN = 7
    d.setUTCDate(d.getUTCDate() - day + 1); // về thứ 2
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
}

function toMonthlyBucket(ms) {
    const d = toDateUTC(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function toYearlyBucket(ms) {
    const d = toDateUTC(ms);
    return Date.UTC(d.getUTCFullYear(), 0, 1);
}

const TIMEFRAME_BUCKETS = {
    '1m': (ms) => Math.floor(ms / 60000) * 60000,
    'daily': toDailyBucket,
    'weekly': toWeeklyBucket,
    'monthly': toMonthlyBucket,
    'yearly': toYearlyBucket,
};

function tickToOHLC(tick, timeframe) {
    const bucketFn = TIMEFRAME_BUCKETS[timeframe];
    if (!bucketFn) return null;

    const candleTime = bucketFn(tick.time);
    const key = `${tick.symbol}_${timeframe}_${candleTime}`;

    let candle = ohlcStore.get(key);

    if (!candle) {
        candle = {
            symbol: tick.symbol,
            timeframe,
            time: candleTime,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: 0,
        };
    } else {
        candle.high = Math.max(candle.high, tick.price);
        candle.low = Math.min(candle.low, tick.price);
        candle.close = tick.price;
    }

    ohlcStore.set(key, candle);
    return candle;
}

async function sendToReverb(tick) {
    try {
        await axios.post(LARAVEL_ENDPOINT, tick, {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: 2000,
        });
    } catch (err) {
        console.error("❌ Reverb send error:", err.message);
    }
}

// ===== CONNECT YAHOO =====
const ws = new WebSocket(YAHOO_WSS);

ws.on("open", () => {
    console.log("✅ Connected to Yahoo");

    ws.send(
        JSON.stringify({
            subscribe: SYMBOLS,
        })
    );
});

ws.on("message", async (data) => {
    try {
        // Yahoo gửi base64
        const buffer = Buffer.from(data.toString(), "base64");

        // Decode protobuf
        const decoded = Ticker.decode(buffer);
        const rawTick = Ticker.toObject(decoded, {
            longs: Number,
            enums: String,
            defaults: true,
        });

        function normalizeYahooTick(tick) {
            return {
                symbol: tick.id,
                price: tick.price,
                time: tick.time, // ms
            };
        }


        // Chuẩn hoá tick
        const tick = normalizeYahooTick(rawTick);

        // ===== AGGREGATE OHLC =====
        const frames = ["1m", "daily", "weekly", "monthly", "yearly"];
        frames.forEach(tf => {
            const candle = tickToOHLC(tick, tf);
            // console.log(`📊 ${tf}`, candle);
        });

        // ===== REALTIME (giữ nguyên) =====
        sendToReverb(tick);

        // ===== DB (sau này) =====
        // flushCandle(candle);

    } catch (err) {
        // Yahoo heartbeat / garbage frame
        if (!err.message.includes("invalid wire type")) {
            console.error("❌ Decode error:", err.message);
        }
    }
});

ws.on("close", () => {
    console.log("🔴 Yahoo connection closed");
});

ws.on("error", (err) => {
    console.error("❌ WS Error:", err.message);
});