import os
import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# --- Tự động tìm file .env ở thư mục backend ---
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# --- Global Config ---
BACKFILL_DAYS = 7  # Quét bù 7 ngày để đảm bảo không mất dữ liệu
BATCH_SIZE = 100 

class DSATurbo:
    def __init__(self):
        try:
            self.conn = pymysql.connect(
                host=os.getenv("DB_HOST", "127.0.0.1"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASS", ""),
                database=os.getenv("DB_NAME", "dsa"),
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
            print(f"✅ Connected to DB: {os.getenv('DB_NAME')} at {os.getenv('DB_HOST')}")
        except Exception as e:
            print(f"❌ DB Connection Error: {e}")
            exit(1)

    def fetch_symbols(self):
        """Lấy danh sách ưu tiên từ snapshot, nếu không có lấy từ instruments"""
        with self.conn.cursor() as cur:
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.updated_at DESC
            """
            cur.execute(sql)
            rows = cur.fetchall()
            if not rows:
                cur.execute("SELECT id, symbol FROM instruments LIMIT 100")
                rows = cur.fetchall()
            return rows

    def ensure_periods(self, inst_id, symbol):
        periods = ['daily', 'weekly', 'monthly', 'yearly']
        p_ids = {}
        with self.conn.cursor() as cur:
            for p in periods:
                slug = f"{symbol.lower()}-{p}"
                cur.execute("""INSERT IGNORE INTO instrument_periods (id, instrument_id, period, market, slug, prefix) 
                               VALUES (%s, %s, %s, 'stock', %s, %s)""", 
                            (str(uuid.uuid4()), inst_id, p, slug, symbol.lower()))
                cur.execute("SELECT id FROM instrument_periods WHERE slug=%s", (slug,))
                p_ids[p] = cur.fetchone()['id']
        self.conn.commit()
        return p_ids

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        
        try:
            # 1. Fetch dữ liệu qua yfinance (Đã xử lý auto_adjust để fix lỗi Open/Close)
            ticker = yf.Ticker(symbol)
            # Fetch 60 ngày để đảm bảo nến Tuần/Tháng hiện tại được tính toán đầy đủ
            df = ticker.history(period="60d", interval="1d", auto_adjust=True)
            
            if df.empty: return

            daily_values = []
            for dt, row in df.iterrows():
                # Chuyển múi giờ về chuẩn Y-m-d 00:00:00 để đồng bộ dữ liệu
                dt_str = dt.strftime('%Y-%m-%d 00:00:00')
                slug = f"{symbol.lower()}-{dt.strftime('%Y-%m-%d')}"
                
                daily_values.append((
                    str(uuid.uuid4()), p_ids['daily'], dt_str, 
                    row['Open'], row['High'], row['Low'], row['Close'], 
                    int(row['Volume']), 'yfinance_v3', slug
                ))

            if daily_values:
                with self.conn.cursor() as cur:
                    sql = """INSERT INTO instrument_data (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug)
                             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                             ON DUPLICATE KEY UPDATE 
                                open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                                close=VALUES(close), volume=VALUES(volume)"""
                    cur.executemany(sql, daily_values)
                self.conn.commit()

            # 2. Tính toán đa khung thời gian từ DataFrame vừa tải (Nhanh + Chuẩn)
            self.aggregate_for_symbol(symbol, p_ids, df)

        except Exception as e:
            print(f" ❌ Error {symbol}: {e}")
            self.conn.rollback()

    def aggregate_for_symbol(self, symbol, p_ids, df):
        # Chuẩn hóa format df cho pandas resample
        df.index = pd.to_datetime(df.index)
        rules = {'weekly': 'W-MON', 'monthly': 'MS', 'yearly': 'YS'}
        
        with self.conn.cursor() as cur:
            for p_type, rule in rules.items():
                agg = df.resample(rule).agg({
                    'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
                }).dropna()
                
                agg_values = []
                for ts, row in agg.iterrows():
                    ts_str = ts.strftime('%Y-%m-%d')
                    slug = f"{symbol.lower()}-{ts_str}-{p_type}"
                    agg_values.append((
                        str(uuid.uuid4()), p_ids[p_type], ts_str, 
                        row['Open'], row['High'], row['Low'], row['Close'], 
                        int(row['Volume']), 'agg_v3', slug
                    ))
                
                if agg_values:
                    sql = """INSERT INTO instrument_data (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug)
                             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                             ON DUPLICATE KEY UPDATE 
                                open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                                close=VALUES(close), volume=VALUES(volume)"""
                    cur.executemany(sql, agg_values)
            self.conn.commit()

    def run(self):
        instruments = self.fetch_symbols()
        total = len(instruments)
        print(f"🚀 Starting Turbo Sync v3 for {total} symbols...")
        
        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst['symbol'].upper()
            self.update_stock(inst['id'], sym)
            elapsed = time.time() - start_time
            print(f"✅ [{idx+1}/{total}] {sym} synced ({elapsed:.2f}s)")

if __name__ == "__main__":
    DSA_TURBO = DSATurbo()
    DSA_TURBO.run()