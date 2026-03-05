import os
import json
import time
import asyncio
import threading
from typing import Dict, Set, Optional, List, Any

import pymysql
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from yliveticker import YLiveTicker
from config.settings import Config

# =========================================================
# Configuration (Lấy từ Config trung tâm)
# =========================================================
app = FastAPI(title="Yahoo Realtime Production Proxy")
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# =========================================================
# Connection Manager (The Heart of Production System)
# =========================================================
class ConnectionManager:
    def __init__(self):
        # Lưu các kết nối đang hoạt động: {WebSocket: Set[Symbols]}
        self.active_connections: Dict[WebSocket, Set[str]] = {}
        self.yahoo_ticker = None
        self.stop_event = threading.Event()
        self.loop = None
        
        # Danh sách các mã "gốc" từ DB (để luôn có data nền)
        self.base_symbols: Set[str] = set()
        # Danh sách tổng tất cả các mã đang được stream từ Yahoo
        self.current_streaming_symbols: Set[str] = set()
        self._lock = threading.Lock()

    def get_all_needed_symbols(self) -> List[str]:
        """Lấy tất cả các mã mà toàn bộ client đang yêu cầu + mã từ DB"""
        with self._lock:
            all_symbols = self.base_symbols.copy()
            for client_symbols in self.active_connections.values():
                all_symbols.update(client_symbols)
            return list(all_symbols)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with self._lock:
            self.active_connections[websocket] = set()
        print(f"✅ New Client. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        with self._lock:
            self.active_connections.pop(websocket, None)
        print(f"❌ Client Left. Remaining: {len(self.active_connections)}")
        if not self.active_connections:
            self.stop_engine()

    def update_subscription(self, websocket: WebSocket, symbols: List[str]):
        new_symbols = {s.upper() for s in symbols if s}
        with self._lock:
            self.active_connections[websocket] = new_symbols
        
        current_all = set(self.get_all_needed_symbols())
        if not current_all.issubset(self.current_streaming_symbols):
            print("🔄 New symbols detected. Restarting Yahoo Stream...")
            self.start_or_restart_engine()

    def start_or_restart_engine(self):
        self.stop_engine()
        self.stop_event.clear()
        
        needed = self.get_all_needed_symbols()
        if not needed:
            return

        self.current_streaming_symbols = set(needed)
        # Lấy event loop hiện tại để broadcast từ thread khác
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

    def _yahoo_worker(self, symbols_to_fetch: List[str]):
        print(f"🚀 Engine active: Streaming {len(symbols_to_fetch)} symbols")
        
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
            self.yahoo_ticker = YLiveTicker(on_msg, symbols_to_fetch)
            self.yahoo_ticker.start()
            while not self.stop_event.is_set():
                time.sleep(1)
        except Exception as e:
            print(f"❌ Engine Error: {e}")

    async def _broadcast(self, payload: dict):
        msg_symbol = payload['symbol']
        msg_str = json.dumps(payload)
        
        tasks = []
        for ws, subscribed_symbols in list(self.active_connections.items()):
            # Gửi nếu client đăng ký hoặc mã đó nằm trong danh sách base (liquidity cao)
            if msg_symbol in subscribed_symbols or msg_symbol in self.base_symbols:
                tasks.append(self._send_safe(ws, msg_str))
        
        if tasks:
            await asyncio.gather(*tasks)

    async def _send_safe(self, ws: WebSocket, data: str):
        try:
            await ws.send_text(data)
        except:
            self.disconnect(ws)

manager = ConnectionManager()

# =========================================================
# Logic tải danh sách mã mặc định từ DB
# =========================================================
def load_db_symbols():
    try:
        # Sử dụng DB_CONFIG từ Config trung tâm
        conn = pymysql.connect(**Config.DB_CONFIG)
        with conn.cursor() as cur:
            # TOP_N cũng lấy từ Config
            cur.execute(
                "SELECT symbol FROM instrument_snapshot ORDER BY liquidity DESC LIMIT %s", 
                (Config.TOP_N,)
            )
            rows = cur.fetchall()
            symbols = {r['symbol'].upper() for r in rows}
            manager.base_symbols = symbols
            print(f"📊 DB Loaded: {len(symbols)} baseline symbols (Top Liquidity).")
    except Exception as e:
        print(f"⚠️ DB Load fail, using defaults. Error: {e}")
        manager.base_symbols = {"BTC-USD", "NVDA", "AAPL", "TSLA"}
    finally:
        if 'conn' in locals(): conn.close()

# =========================================================
# API Routes
# =========================================================
@app.on_event("startup")
async def startup_event():
    load_db_symbols()

@app.websocket("/ws/quotes")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                if data.get("type") == "subscribe":
                    symbols = data.get("symbols", [])
                    manager.update_subscription(websocket, symbols)
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/health")
async def health():
    return {
        "status": "online",
        "active_clients": len(manager.active_connections),
        "streaming_count": len(manager.current_streaming_symbols),
        "base_symbols_count": len(manager.base_symbols)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)