import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime

from config.settings import Config

class DSATurbo:
    def __init__(self):
        try:
            self.conn = pymysql.connect(**Config.DB_CONFIG)
            self.conn.autocommit(False) 
            print(f"✅ Connected to DB: {Config.DB_CONFIG['database']}")
        except Exception as e:
            print(f"❌ DB Connection Error: {e}")
            exit(1)

    def generate_slug(self, symbol, dt_obj):
        """
        Format chuẩn duy nhất cho mọi nến: symbol-YYYY-MM-DD HH:mm:ss
        """
        time_part = dt_obj.strftime('%Y-%m-%d 00:00:00')
        return f"{symbol.lower()}-{time_part}"

    def fetch_symbols(self):
        with self.conn.cursor() as cur:
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.volume DESC
                LIMIT %s
            """
            cur.execute(sql, (getattr(Config, 'TOP_N', 500),))
            return cur.fetchall()

    def ensure_periods(self, inst_id, symbol):
        periods = ['daily', 'weekly', 'monthly', 'yearly']
        p_ids = {}
        with self.conn.cursor() as cur:
            for p in periods:
                p_slug = f"{symbol.lower()}-{p}"
                cur.execute("""
                    INSERT INTO instrument_periods (id, instrument_id, period, market, slug, prefix) 
                    VALUES (%s, %s, %s, 'stock', %s, %s)
                    ON DUPLICATE KEY UPDATE id=id
                """, (str(uuid.uuid4()), inst_id, p, p_slug, symbol.lower()))
                
                cur.execute("SELECT id FROM instrument_periods WHERE slug=%s", (p_slug,))
                p_ids[p] = cur.fetchone()['id']
        self.conn.commit()
        return p_ids

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="60d", interval="1d", auto_adjust=True)
            if df.empty: return

            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # --- Xử lý Daily ---
            daily_values = []
            for dt, row in df.iterrows():
                dt_str = dt.strftime('%Y-%m-%d 00:00:00')
                slug = self.generate_slug(symbol, dt)
                
                daily_values.append((
                    str(uuid.uuid4()), p_ids['daily'], dt_str, 
                    row['Open'], row['High'], row['Low'], row['Close'], 
                    int(row['Volume']), 'yfinance_v3.5', slug,
                    now_str, now_str
                ))

            if daily_values:
                self._execute_upsert(daily_values)

            # --- Xử lý Aggregate (Weekly, Monthly, Yearly) ---
            self.aggregate_for_symbol(symbol, p_ids, df, now_str)

        except Exception as e:
            print(f" ❌ Error {symbol}: {e}")
            self.conn.rollback()

    def _execute_upsert(self, values):
        """Helper để thực hiện INSERT ... ON DUPLICATE KEY UPDATE"""
        with self.conn.cursor() as cur:
            sql = """INSERT INTO instrument_data 
                     (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug, created_at, updated_at)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                     ON DUPLICATE KEY UPDATE 
                        open=VALUES(open), high=VALUES(high), low=VALUES(low), 
                        close=VALUES(close), volume=VALUES(volume), 
                        updated_at=VALUES(updated_at)"""
            cur.executemany(sql, values)
        self.conn.commit()

    def aggregate_for_symbol(self, symbol, p_ids, df, now_str):
        df.index = pd.to_datetime(df.index)
        rules = {'weekly': 'W-MON', 'monthly': 'MS', 'yearly': 'YS'}
        
        for p_type, rule in rules.items():
            agg = df.resample(rule).agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
            
            agg_values = []
            for ts, row in agg.iterrows():
                dt_str = ts.strftime('%Y-%m-%d 00:00:00')
                slug = self.generate_slug(symbol, ts) # Slug chung format với Daily
                
                agg_values.append((
                    str(uuid.uuid4()), p_ids[p_type], dt_str, 
                    row['Open'], row['High'], row['Low'], row['Close'], 
                    int(row['Volume']), 'agg_v3.5', slug,
                    now_str, now_str
                ))
            
            if agg_values:
                self._execute_upsert(agg_values)

    def run(self):
        start_turbo = time.time()
        instruments = self.fetch_symbols()
        total = len(instruments)
        print(f"🚀 Starting Turbo Sync v3.5 (Unified Slug Format) for Top {total} symbols...")
        
        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst['symbol'].upper()
            self.update_stock(inst['id'], sym)
            elapsed = time.time() - start_time
            print(f"✅ [{idx+1}/{total}] {sym} synced ({elapsed:.2f}s)")
            
        self.conn.close()
        print(f"🏁 Finish! Total time: {(time.time() - start_turbo)/60:.2f} minutes.")

if __name__ == "__main__":
    DSA_TURBO = DSATurbo()
    DSA_TURBO.run()