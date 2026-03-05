import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime

# --- Import Config từ hệ thống mới ---
from config.settings import Config

class DSATurbo:
    def __init__(self):
        try:
            # Sử dụng Config.DB_CONFIG đã được định nghĩa trong settings.py
            self.conn = pymysql.connect(**Config.DB_CONFIG)
            # Lưu ý: settings.py cần có autocommit=False hoặc xử lý thủ công
            self.conn.autocommit(False) 
            
            print(f"✅ Connected to DB: {Config.DB_CONFIG['database']} at {Config.DB_CONFIG['host']}")
        except Exception as e:
            print(f"❌ DB Connection Error: {e}")
            exit(1)

    def fetch_symbols(self):
        """Lấy danh sách ưu tiên từ snapshot dựa trên TOP_N trong Config"""
        with self.conn.cursor() as cur:
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.volume DESC
                LIMIT %s
            """
            cur.execute(sql, (Config.TOP_N,))
            rows = cur.fetchall()
            
            if not rows:
                cur.execute("SELECT id, symbol FROM instruments LIMIT %s", (Config.TOP_N,))
                rows = cur.fetchall()
            return rows

    def ensure_periods(self, inst_id, symbol):
        periods = ['daily', 'weekly', 'monthly', 'yearly']
        p_ids = {}
        with self.conn.cursor() as cur:
            for p in periods:
                slug = f"{symbol.lower()}-{p}"
                cur.execute("""
                    INSERT IGNORE INTO instrument_periods (id, instrument_id, period, market, slug, prefix) 
                    VALUES (%s, %s, %s, 'stock', %s, %s)
                """, (str(uuid.uuid4()), inst_id, p, slug, symbol.lower()))
                
                cur.execute("SELECT id FROM instrument_periods WHERE slug=%s", (slug,))
                result = cur.fetchone()
                p_ids[p] = result['id']
        self.conn.commit()
        return p_ids

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        
        try:
            ticker = yf.Ticker(symbol)
            # Fetch 60 ngày để đảm bảo nến tuần/tháng hiện tại đầy đủ
            df = ticker.history(period="60d", interval="1d", auto_adjust=True)
            
            if df.empty: return

            daily_values = []
            for dt, row in df.iterrows():
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

            # Tự động tính Weekly, Monthly, Yearly
            self.aggregate_for_symbol(symbol, p_ids, df)

        except Exception as e:
            print(f" ❌ Error {symbol}: {e}")
            self.conn.rollback()

    def aggregate_for_symbol(self, symbol, p_ids, df):
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
        print(f"🚀 Starting Turbo Sync v3 for Top {total} symbols...")
        
        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst['symbol'].upper()
            self.update_stock(inst['id'], sym)
            elapsed = time.time() - start_time
            print(f"✅ [{idx+1}/{total}] {sym} synced ({elapsed:.2f}s)")
            
        self.conn.close()

if __name__ == "__main__":
    DSA_TURBO = DSATurbo()
    DSA_TURBO.run()