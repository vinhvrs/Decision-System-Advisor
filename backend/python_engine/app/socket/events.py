import os
import json
import time
import asyncio
import threading
from typing import Dict, Set, List, Any

import pymysql
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from yliveticker import YLiveTicker

# Lấy cấu hình từ file settings.py của bạn
try:
    from config.settings import settings
    DB_CONFIG = {
        "host": os.getenv("DB_HOST", "mysql"),
        "port": int(os.getenv("DB_PORT", 3306)),
        "user": os.getenv("DB_USERNAME", "root"),
        "password": os.getenv("DB_PASSWORD", "root"),
        "database": os.getenv("DB_DATABASE", "dsa"),
        "cursorclass": pymysql.cursors.DictCursor
    }
except ImportError:
    # Fallback nếu không import được settings
    DB_CONFIG = {
        "host": "mysql",
        "port": 3306,
        "user": "root",
        "password": "root",
        "database": "dsa",
        "cursorclass": pymysql.cursors.DictCursor
    }

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, Set[str]] = {}
        self.yahoo_ticker = None
        self.stop_event = threading.Event()
        self.loop = None
        self.base_symbols: Set[str] = set()
        self.current_streaming_symbols: Set[str] = set()
        self._lock = threading.Lock()
        # Store current period candle (open, high, low, close, volume, time) per symbol for gap-free socket
        self._current_candle_cache: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with self._lock:
            self.active_connections[websocket] = set()
        print(f"✅ Client connected to Realtime Proxy.")

    def disconnect(self, websocket: WebSocket):
        with self._lock:
            self.active_connections.pop(websocket, None)
        # Giữ kết nối Yahoo luôn chạy để tránh bị block do reconnect quá nhiều
        # → chỉ dọn connection client, không tắt engine.

    def update_subscription(self, websocket: WebSocket, symbols: List[str], period: str = "daily"):
        new_symbols = {s.upper() for s in symbols if s}
        with self._lock:
            self.active_connections[websocket] = new_symbols

        # Fetch and store current candle from DB, then send initial data (open from DB, socket continues with price only)
        asyncio.run_coroutine_threadsafe(
            self.send_initial_data(websocket, list(new_symbols), period), self.loop
        )

        current_all = self.get_all_needed_symbols()
        if not set(current_all).issubset(self.current_streaming_symbols):
            self.start_or_restart_engine()

    def _fetch_current_candle(self, symbol: str, period: str) -> Dict[str, Any] | None:
        """Fetch current period candle from DB for open price. Store in cache. Keep format: open, high, low, close, volume, time."""
        try:
            conn = pymysql.connect(**DB_CONFIG)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT d.open, d.high, d.low, d.close, d.volume, d.timestamps
                    FROM instrument_data d
                    JOIN instrument_periods p ON p.id = d.instrument_period_id
                    JOIN instruments i ON i.id = p.instrument_id
                    WHERE UPPER(TRIM(i.symbol)) = %s AND p.period = %s
                    ORDER BY d.timestamps DESC
                    LIMIT 1
                """, (symbol.upper(), period))
                row = cur.fetchone()
            conn.close()
            if not row or row.get("open") is None:
                return None
            ts = row.get("timestamps")
            try:
                if isinstance(ts, str):
                    from datetime import datetime
                    ts_clean = ts.replace("Z", "").replace("+00:00", "").strip()
                    time_ms = int(time.time() * 1000)
                    for fmt, length in (("%Y-%m-%d %H:%M:%S", 19), ("%Y-%m-%dT%H:%M:%S", 19), ("%Y-%m-%d", 10)):
                        try:
                            s = ts_clean[:length] if len(ts_clean) >= length else ts_clean
                            dt = datetime.strptime(s, fmt)
                            time_ms = int(dt.timestamp() * 1000)
                            break
                        except (ValueError, TypeError):
                            continue
                else:
                    time_ms = int(float(ts) * 1000) if ts else int(time.time() * 1000)
            except Exception:
                time_ms = int(time.time() * 1000)
            candle = {
                "open": float(row["open"] or 0),
                "high": float(row["high"] or row["open"] or 0),
                "low": float(row["low"] or row["open"] or 0),
                "close": float(row["close"] or row["open"] or 0),
                "volume": int(row["volume"] or 0),
                "time": time_ms,
            }
            with self._lock:
                self._current_candle_cache[symbol.upper()] = candle
            return candle
        except Exception as e:
            print(f"[Socket] Fetch current candle error for {symbol}: {e}")
            return None

    async def send_initial_data(self, websocket: WebSocket, symbols: List[str], period: str = "daily"):
        """Fetch current candle from DB (open price), store it, send in initial_quote. Socket continues with price only (no open)."""
        try:
            for symbol in symbols:
                candle = self._fetch_current_candle(symbol, period)
                payload = {
                    "type": "initial_quote",
                    "symbol": symbol,
                    "status": "watching",
                    "ts": int(time.time() * 1000),
                    "note": "Waiting for next trade from Yahoo...",
                }
                if candle:
                    payload["current_candle"] = candle
                await websocket.send_text(json.dumps(payload))
        except Exception as e:
            print(f"Initial send error: {e}")

    def get_all_needed_symbols(self) -> List[str]:
        with self._lock:
            all_symbols = self.base_symbols.copy()
            for client_symbols in self.active_connections.values():
                all_symbols.update(client_symbols)
            return list(all_symbols)

    def start_or_restart_engine(self):
        self.stop_engine()
        self.stop_event.clear()
        needed = self.get_all_needed_symbols()
        if not needed: return

        self.current_streaming_symbols = set(needed)
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
        
        thread = threading.Thread(target=self._yahoo_worker, args=(needed,), daemon=True)
        thread.start()

    def stop_engine(self):
        self.stop_event.set()
        if self.yahoo_ticker:
            try: self.yahoo_ticker.stop()
            except: pass
        self.yahoo_ticker = None

    def _yahoo_worker(self, symbols: List[str]):
        """
        Worker giữ kết nối lâu dài tới Yahoo:
        - Nếu có lỗi / disconnect → sleep vài giây rồi tự reconnect.
        - Chỉ dừng hẳn khi self.stop_event được set (shutdown server).
        """

        def on_msg(ws, msg):
            if self.stop_event.is_set():
                return
            payload = {
                "type": "quote",
                "symbol": msg.get("id", "").upper(),
                "price": msg.get("price"),
                "change": msg.get("changePercent"),
                "volume": int(msg.get("volume") or msg.get("dayVolume") or 0),
                "ts": int(time.time() * 1000),
            }
            if self.loop and self.loop.is_running():
                asyncio.run_coroutine_threadsafe(self._broadcast(payload), self.loop)

        backoff = 5
        while not self.stop_event.is_set():
            try:
                print(f"[Yahoo] Connecting for symbols: {symbols}")
                self.yahoo_ticker = YLiveTicker(on_msg, symbols)
                self.yahoo_ticker.start()

                # Giữ vòng lặp cho tới khi server shutdown
                while not self.stop_event.is_set():
                    time.sleep(1)

                break  # shutdown requested
            except Exception as e:
                print(f"[Yahoo] Error, will reconnect in {backoff}s: {e}")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)  # exponential up to 60s
            finally:
                if self.yahoo_ticker:
                    try:
                        self.yahoo_ticker.stop()
                    except Exception:
                        pass
                    self.yahoo_ticker = None

    async def _broadcast(self, payload: dict):
        msg_symbol = payload['symbol']
        msg_str = json.dumps(payload)
        tasks = []
        with self._lock:
            for ws, subscribed_symbols in self.active_connections.items():
                if msg_symbol in subscribed_symbols:
                    tasks.append(self._send_safe(ws, msg_str))
        if tasks: await asyncio.gather(*tasks)

    async def _send_safe(self, ws: WebSocket, data: str):
        try: await ws.send_text(data)
        except: self.disconnect(ws)

manager = ConnectionManager()

@router.on_event("startup")
async def startup_event():
    # Load mã từ DB để 'warm-up' engine
    try:
        conn = pymysql.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            cur.execute("SELECT symbol FROM instrument_snapshot LIMIT 10")
            manager.base_symbols = {r['symbol'].upper() for r in cur.fetchall()}
            manager.start_or_restart_engine()
    except:
        manager.base_symbols = {"BTC-USD", "ETH-USD"} # Crypto luôn chạy 24/7
        manager.start_or_restart_engine()
    finally:
        if 'conn' in locals(): conn.close()

@router.websocket("/ws/quotes")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            if data.get("type") == "subscribe":
                manager.update_subscription(
                    websocket,
                    data.get("symbols", []),
                    data.get("period", "daily"),
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)