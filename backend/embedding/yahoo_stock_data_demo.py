import os
import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# --- Khởi tạo môi trường ---
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class DSATurbo:
    def __init__(self):
        try:
            self.conn = pymysql.connect(
                host=os.getenv("DB_HOST", "127.0.0.1"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASS", "root"),
                database=os.getenv("DB_NAME", "dsa"),
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
        except Exception as e:
            print(f"❌ Kết nối DB thất bại: {e}")
            exit(1)

    def fetch_symbols(self):
        with self.conn.cursor() as cur:
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.updated_at DESC
            """
            cur.execute(sql)
            rows = cur.fetchall()
            return rows if rows else []

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
            ticker = yf.Ticker(symbol)
            # Lấy 60 ngày để đảm bảo nến Tuần/Tháng hiện tại khớp giá
            df = ticker.history(period="60d", interval="1d", auto_adjust=True)
            if df.empty: return

            daily_values = []
            for dt, row in df.iterrows():
                # QUAN TRỌNG: Chuẩn hóa mốc thời gian về 14:30:00 (giờ chốt phiên chuẩn)
                # Điều này giúp UI hiển thị đồng nhất nhưng Slug vẫn là duy nhất theo ngày
                date_str = dt.strftime('%Y-%m-%d')
                db_timestamp = f"{date_str} 14:30:00" 
                
                # SLUG CHỈ THEO NGÀY: Chìa khóa để chống Duplicate 2 khung giờ trong 1 ngày
                # Nếu Yahoo trả về nến lúc 15:00, nó sẽ UPDATE vào nến 14:30 của ngày đó
                day_slug = f"{symbol.lower()}-{date_str}"
                
                daily_values.append((
                    str(uuid.uuid4()), p_ids['daily'], db_timestamp, 
                    row['Open'], row['High'], row['Low'], row['Close'], 
                    int(row['Volume']), 'yfinance_v5', day_slug
                ))

            if daily_values:
                with self.conn.cursor() as cur:
                    sql = """INSERT INTO instrument_data (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug)
                             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                             ON DUPLICATE KEY UPDATE 
                                open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                                close=VALUES(close), volume=VALUES(volume), 
                                timestamps=VALUES(timestamps), updated_at=NOW()"""
                    cur.executemany(sql, daily_values)
                self.conn.commit()

            self.aggregate_for_symbol(symbol, p_ids, df)

        except Exception as e:
            print(f" ❌ Lỗi {symbol}: {e}")
            self.conn.rollback()

    def aggregate_for_symbol(self, symbol, p_ids, df):
        rules = {'weekly': 'W-MON', 'monthly': 'MS', 'yearly': 'YS'}
        with self.conn.cursor() as cur:
            for p_type, rule in rules.items():
                agg = df.resample(rule).agg({
                    'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
                }).dropna()
                
                agg_values = []
                for ts, row in agg.iterrows():
                    date_str = ts.strftime('%Y-%m-%d')
                    # Slug cho các khung lớn: aapl-2026-03-01-weekly
                    slug = f"{symbol.lower()}-{date_str}-{p_type}"
                    
                    agg_values.append((
                        str(uuid.uuid4()), p_ids[p_type], date_str, 
                        row['Open'], row['High'], row['Low'], row['Close'], 
                        int(row['Volume']), 'agg_v5', slug
                    ))
                
                if agg_values:
                    sql = """INSERT INTO instrument_data (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug)
                             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                             ON DUPLICATE KEY UPDATE 
                                open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                                close=VALUES(close), volume=VALUES(volume), updated_at=NOW()"""
                    cur.executemany(sql, agg_values)
            self.conn.commit()

    def run(self):
        instruments = self.fetch_symbols()
        print(f"🚀 Bắt đầu Turbo Sync v5 cho {len(instruments)} mã...")
        for idx, inst in enumerate(instruments):
            s_time = time.time()
            self.update_stock(inst['id'], inst['symbol'].upper())
            print(f"✅ [{idx+1}] {inst['symbol']} ({time.time()-s_time:.2f}s)")

if __name__ == "__main__":
    DSA_TURBO = DSATurbo()
    DSA_TURBO.run()