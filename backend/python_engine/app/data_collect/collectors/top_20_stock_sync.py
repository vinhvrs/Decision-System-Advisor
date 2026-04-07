import uuid
import time
import pandas as pd
import yfinance as yf
import pymysql
from datetime import datetime
import os
import sys

# Repo root for config import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from config.settings import settings

class DSADemoSync:
    def __init__(self):
        try:
            self.db_config = settings.DB_CONFIG.copy()
            self.db_config['cursorclass'] = pymysql.cursors.DictCursor
            self.conn = pymysql.connect(**self.db_config)
            self.conn.autocommit(False) 
            print(f"Connected to DB: {self.db_config['database']}")
        except Exception as e:
            print(f"DB connection error: {e}")
            exit(1)

    def generate_slug(self, symbol, period, dt_obj):
        """Slug: symbol-period-YYYY-MM-DD 00:00:00."""
        time_part = dt_obj.strftime('%Y-%m-%d 00:00:00')
        return f"{symbol.lower()}-{period.lower()}-{time_part}"

    def fetch_symbols(self):
        """Top 20 symbols by snapshot volume."""
        with self.conn.cursor() as cur:
            sql = """
                SELECT i.id, i.symbol 
                FROM instrument_snapshot s
                JOIN instruments i ON s.instrument_id = i.id
                ORDER BY s.volume DESC
                LIMIT 20
            """
            cur.execute(sql)
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
                result = cur.fetchone()
                p_ids[p] = result['id']
        self.conn.commit()
        return p_ids

    def update_stock(self, inst_id, symbol):
        p_ids = self.ensure_periods(inst_id, symbol)
        try:
            ticker = yf.Ticker(symbol)
            # Demo: last 3 days only
            df = ticker.history(period="3d", interval="1d", auto_adjust=True)
            if df.empty: 
                print(f"   No data for {symbol}")
                return

            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Daily rows
            daily_values = []
            for dt, row in df.iterrows():
                dt_str = dt.strftime('%Y-%m-%d 00:00:00')
                slug = self.generate_slug(symbol, 'daily', dt)
                
                daily_values.append((
                    str(uuid.uuid4()), p_ids['daily'], dt_str, 
                    float(row['Open']), float(row['High']), float(row['Low']), float(row['Close']), 
                    int(row['Volume']), 'yfinance_demo', slug,
                    now_str, now_str
                ))

            if daily_values:
                self._execute_upsert(daily_values)

            # Still run aggregates on the short window to exercise resample path
            self.aggregate_for_symbol(symbol, p_ids, df, now_str)

        except Exception as e:
            print(f"   Error {symbol}: {e}")
            self.conn.rollback()

    def _execute_upsert(self, values):
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
                slug = self.generate_slug(symbol, p_type, ts)
                
                agg_values.append((
                    str(uuid.uuid4()), p_ids[p_type], dt_str, 
                    float(row['Open']), float(row['High']), float(row['Low']), float(row['Close']), 
                    int(row['Volume']), 'agg_demo', slug,
                    now_str, now_str
                ))
            
            if agg_values:
                self._execute_upsert(agg_values)

    def run(self):
        start_demo = time.time()
        instruments = self.fetch_symbols()
        total = len(instruments)
        
        print("Starting demo sync (top 20 symbols, 3d backfill)...")
        
        for idx, inst in enumerate(instruments):
            start_time = time.time()
            sym = inst['symbol'].upper()
            self.update_stock(inst['id'], sym)
            elapsed = time.time() - start_time
            print(f"   [{idx+1}/{total}] {sym} synced ({elapsed:.2f}s)")
            
        self.conn.close()
        print(f"Demo done. Total time: {time.time() - start_demo:.2f}s.")

if __name__ == "__main__":
    DEMO = DSADemoSync()
    DEMO.run()