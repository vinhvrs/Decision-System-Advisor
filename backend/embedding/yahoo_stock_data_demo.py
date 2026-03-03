import os
import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime
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
            print("✅ Kết nối database thành công.")
        except Exception as e:
            print(f"❌ Kết nối DB thất bại: {e}")
            exit(1)

    def fetch_symbols(self):
        """Lấy Top 20 mã có Liquidity hoặc Volume cao nhất"""
        with self.conn.cursor() as cur:
            # Sắp xếp theo Liquidity trước, sau đó tới Volume để lấy mã chất lượng nhất
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.liquidity DESC, s.volume DESC
                LIMIT 20
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
            # Lấy 60 ngày dữ liệu
            df = ticker.history(period="60d", interval="1d", auto_adjust=True)
            if df.empty: return

            daily_values = []
            for dt, row in df.iterrows():
                date_str = dt.strftime('%Y-%m-%d')
                db_timestamp = f"{date_str} 14:30:00" 
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
            print(f" ❌ Lỗi khi cập nhật {symbol}: {e}")
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
        print(f"🚀 Bắt đầu Sync cho Top {len(instruments)} mã có thanh khoản cao nhất...")
        
        for idx, inst in enumerate(instruments):
            s_time = time.time()
            symbol = inst['symbol'].upper()
            self.update_stock(inst['id'], symbol)
            print(f"✅ [{idx+1}/20] {symbol} ({time.time()-s_time:.2f}s)")
        
        self.conn.close()
        print("✨ Hoàn tất cập nhật dữ liệu vào Database.")

if __name__ == "__main__":
    DSA_TURBO = DSATurbo()
    DSA_TURBO.run()