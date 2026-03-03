import os
import json
import time
import asyncio
import threading
from typing import Dict, Set, Optional, List, Any

import pymysql
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Realtime Yahoo WS decoder (protobuf handled inside)
# pip install yliveticker
from yliveticker import YLiveTicker


# =========================================================
# Config
# =========================================================
APP_NAME = "Yahoo Realtime WS Proxy"
YAHOO_WS_URL = os.getenv("YAHOO_WS_URL", "wss://streamer.finance.yahoo.com/?version=2")

TOP_N = int(os.getenv("TOP_N", "20"))
ORDER_BY = os.getenv("ORDER_BY", "liquidity").lower()  # liquidity | volume
SYMBOL_REFRESH_SEC = int(os.getenv("SYMBOL_REFRESH_SEC", "300"))

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "root")
DB_NAME = os.getenv("DB_NAME", "dsa")

# CORS for React dev/prod
CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "*").split(",")


# =========================================================
# DB Helpers
# =========================================================
def db_conn():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        charset="utf8mb4",
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )


def load_top_symbols_from_snapshot(limit: int = 20) -> List[str]:
    """
    Pull 'most active' symbols from instrument_snapshot.

    instrument_snapshot columns:
      - symbol, volume, liquidity, updated_at

    If multiple rows per symbol exist, this query takes latest row per symbol,
    then orders by liquidity/volume.
    """
    order_clause = "COALESCE(s.liquidity,0) DESC, COALESCE(s.volume,0) DESC" if ORDER_BY == "liquidity" else \
                   "COALESCE(s.volume,0) DESC, COALESCE(s.liquidity,0) DESC"

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT s.symbol
                FROM instrument_snapshot s
                JOIN (
                    SELECT symbol, MAX(updated_at) AS max_updated
                    FROM instrument_snapshot
                    WHERE symbol IS NOT NULL AND symbol <> ''
                    GROUP BY symbol
                ) t
                  ON s.symbol = t.symbol AND s.updated_at = t.max_updated
                ORDER BY {order_clause}, s.symbol ASC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall() or []
            return [r["symbol"].upper() for r in rows if r.get("symbol")]
    finally:
        conn.close()


# =========================================================
# FastAPI app
# =========================================================
app = FastAPI(title=APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ALLOW_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": APP_NAME}


@app.get("/symbols")
def symbols():
    """
    Returns current server-side subscribed symbols (top active from DB).
    React can call this to show default watchlist.
    """
    return {"symbols": sorted(list(state.symbols))}


# =========================================================
# Connection Manager (clients)
# =========================================================
class WSManager:
    def __init__(self):
        self.clients: Set[WebSocket] = set()
        self.client_filters: Dict[WebSocket, Set[str]] = {}  # per-client symbol filter

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)
        self.client_filters[ws] = set()  # empty = receive all

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)
        self.client_filters.pop(ws, None)

    def set_filter(self, ws: WebSocket, symbols: List[str]):
        self.client_filters[ws] = {s.upper() for s in symbols if s}

    async def broadcast(self, payload: Dict[str, Any]):
        """
        Broadcast JSON payload to all clients (with optional per-client symbol filter).
        """
        if not self.clients:
            return

        msg_symbol = (payload.get("symbol") or "").upper()
        dead: List[WebSocket] = []

        for ws in list(self.clients):
            filt = self.client_filters.get(ws, set())
            if filt and msg_symbol and msg_symbol not in filt:
                continue
            try:
                await ws.send_text(json.dumps(payload, ensure_ascii=False))
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(ws)


manager = WSManager()


# =========================================================
# Yahoo Streamer State + Background Thread
# =========================================================
class StreamState:
    def __init__(self):
        self.symbols: Set[str] = set()
        self._lock = threading.Lock()

    def set_symbols(self, symbols: List[str]):
        with self._lock:
            self.symbols = {s.upper() for s in symbols if s}

    def get_symbols(self) -> List[str]:
        with self._lock:
            return sorted(list(self.symbols))


state = StreamState()


def _normalize_yahoo_msg(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    yliveticker returns a dict-like message.
    Normalize fields to a stable JSON contract for React.

    Common fields (may vary):
      - id / symbol
      - price
      - time / timestamp
      - change / changePercent
      - dayHigh/dayLow/open/prevClose/volume
    """
    sym = (raw.get("id") or raw.get("symbol") or "").upper()

    payload = {
        "type": "quote",
        "symbol": sym,
        "ts": int(time.time() * 1000),  # server receive time (ms)
        "data": raw,                    # keep full raw for debugging/UI flexibility
    }
    return payload


def yahoo_thread(loop: asyncio.AbstractEventLoop, stop_event: threading.Event):
    """
    Runs in a dedicated thread.
    1) Pull top symbols from DB (instrument_snapshot)
    2) Connect to Yahoo WS using yliveticker
    3) Push updates into asyncio loop -> broadcast to React clients
    """
    ticker: Optional[YLiveTicker] = None
    last_refresh = 0

    def on_msg(msg: Dict[str, Any]):
        payload = _normalize_yahoo_msg(msg)
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), loop)

    while not stop_event.is_set():
        # refresh watchlist periodically
        if (time.time() - last_refresh) > SYMBOL_REFRESH_SEC or not state.get_symbols():
            try:
                symbols = load_top_symbols_from_snapshot(limit=TOP_N)
                if symbols:
                    state.set_symbols(symbols)
                last_refresh = time.time()
            except Exception as e:
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({"type": "error", "message": f"load_symbols_failed: {str(e)}"}),
                    loop
                )
                time.sleep(3)
                continue

        symbols = state.get_symbols()
        if not symbols:
            time.sleep(2)
            continue

        try:
            # create or recreate streamer
            ticker = YLiveTicker(on_msg, symbols=symbols, url=YAHOO_WS_URL)
            ticker.start()

            # keep alive until need refresh
            while not stop_event.is_set():
                # if refresh due, restart ticker to apply new symbols
                if (time.time() - last_refresh) > SYMBOL_REFRESH_SEC:
                    break
                time.sleep(1)

        except Exception as e:
            asyncio.run_coroutine_threadsafe(
                manager.broadcast({"type": "error", "message": f"yahoo_stream_failed: {str(e)}"}),
                loop
            )
            time.sleep(3)

        finally:
            try:
                if ticker:
                    ticker.stop()
            except Exception:
                pass
            ticker = None


stop_event = threading.Event()
bg_thread: Optional[threading.Thread] = None


@app.on_event("startup")
async def on_startup():
    """
    Start background thread that listens Yahoo WebSocket and broadcasts to clients.
    """
    global bg_thread
    loop = asyncio.get_running_loop()

    # initial symbols load
    try:
        symbols = load_top_symbols_from_snapshot(limit=TOP_N)
        state.set_symbols(symbols)
    except Exception:
        state.set_symbols([])

    bg_thread = threading.Thread(target=yahoo_thread, args=(loop, stop_event), daemon=True)
    bg_thread.start()


@app.on_event("shutdown")
async def on_shutdown():
    stop_event.set()


# =========================================================
# WebSocket endpoint for React
# =========================================================
@app.websocket("/ws/quotes")
async def ws_quotes(ws: WebSocket):
    """
    React connects here:
      ws://<host>:<port>/ws/quotes

    Optional: client can send:
      { "type": "subscribe", "symbols": ["AAPL","NVDA"] }
    to filter only those symbols for that client.
    """
    await manager.connect(ws)

    # send handshake info
    await ws.send_text(json.dumps({
        "type": "hello",
        "symbols_default": state.get_symbols(),
        "note": "send {type:'subscribe', symbols:[...]} to filter per-client"
    }, ensure_ascii=False))

    try:
        while True:
            msg = await ws.receive_text()
            try:
                data = json.loads(msg)
            except Exception:
                await ws.send_text(json.dumps({"type": "error", "message": "invalid_json"}, ensure_ascii=False))
                continue

            if data.get("type") == "subscribe":
                symbols = data.get("symbols") or []
                manager.set_filter(ws, symbols)
                await ws.send_text(json.dumps({"type": "subscribed", "symbols": [s.upper() for s in symbols]}, ensure_ascii=False))
            elif data.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}, ensure_ascii=False))
            else:
                await ws.send_text(json.dumps({"type": "error", "message": "unknown_command"}, ensure_ascii=False))

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)