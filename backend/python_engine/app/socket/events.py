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

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with self._lock:
            self.active_connections[websocket] = set()
        print(f"✅ Client connected to Realtime Proxy.")

    def disconnect(self, websocket: WebSocket):
        with self._lock:
            self.active_connections.pop(websocket, None)
        if not self.active_connections:
            self.stop_engine()

    def update_subscription(self, websocket: WebSocket, symbols: List[str]):
        new_symbols = {s.upper() for s in symbols if s}
        with self._lock:
            self.active_connections[websocket] = new_symbols
        
        # Gửi ngay giá hiện tại từ DB/Snapshot để user thấy data ngay lập tức
        asyncio.run_coroutine_threadsafe(self.send_initial_data(websocket, list(new_symbols)), self.loop)

        current_all = self.get_all_needed_symbols()
        if not set(current_all).issubset(self.current_streaming_symbols):
            self.start_or_restart_engine()

    async def send_initial_data(self, websocket: WebSocket, symbols: List[str]):
        """Mẹo để thấy data realtime 'giả' ngay khi subscribe"""
        try:
            # Ở đây bạn có thể query từ bảng 'instruments' hoặc 'instrument_snapshot'
            # Để demo nhanh, mình sẽ gửi một bản tin khởi tạo
            for symbol in symbols:
                await websocket.send_text(json.dumps({
                    "type": "initial_quote",
                    "symbol": symbol,
                    "status": "watching",
                    "ts": int(time.time() * 1000),
                    "note": "Waiting for next trade from Yahoo..."
                }))
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
        def on_msg(ws, msg):
            if self.stop_event.is_set(): return
            payload = {
                "type": "quote",
                "symbol": msg.get('id', '').upper(),
                "price": msg.get('price'),
                "change": msg.get('changePercent'),
                "volume": int(msg.get('volume') or msg.get('dayVolume') or 0),
                "ts": int(time.time() * 1000)
            }
            if self.loop and self.loop.is_running():
                asyncio.run_coroutine_threadsafe(self._broadcast(payload), self.loop)

        try:
            self.yahoo_ticker = YLiveTicker(on_msg, symbols)
            self.yahoo_ticker.start()
            while not self.stop_event.is_set(): time.sleep(1)
        except Exception as e: print(f"Yahoo Error: {e}")

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
                manager.update_subscription(websocket, data.get("symbols", []))
    except WebSocketDisconnect:
        manager.disconnect(websocket)