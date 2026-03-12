# import os
# import sys
# import pymysql
# import redis
# import json
# import math
# import time
# import yfinance as yf
# from datetime import datetime

# # Import cấu hình chuẩn theo hệ thống
# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
# from config.settings import settings

# class MarketSyncService:
#     def __init__(self):
#         # 1. Cấu hình Database & Redis
#         self.db_config = settings.DB_CONFIG.copy()
#         self.db_config['cursorclass'] = pymysql.cursors.DictCursor
        
#         self.r = redis.Redis(
#             host=settings.REDIS_HOST,
#             port=settings.REDIS_PORT,
#             db=settings.REDIS_DB,
#             password=getattr(settings, 'REDIS_PASSWORD', None),
#             decode_responses=True
#         )
        
#         # 2. Các Key lưu trữ Redis
#         self.heatmap_key = 'heatmap:daily'
#         self.mcap_ranking_key = 'marketcap:ranking:daily'
#         self.liq_ranking_key = 'liquidity:ranking:daily'
#         self.change_ranking_key = 'heatmap:ranking:change'

#     def safe_float(self, value):
#         """Chuyển đổi sang float an toàn, tránh lỗi NoneType"""
#         try:
#             return float(value) if value is not None else 0.0
#         except (ValueError, TypeError):
#             return 0.0

#     def sync(self):
#         try:
#             conn = pymysql.connect(**self.db_config)
#             conn.autocommit(True)
            
#             with conn.cursor() as cur:
#                 print(f"--- 🔄 SYNCING MARKET DATA: {datetime.now()} ---")

#                 # BƯỚC 1: Query lấy dữ liệu giá mới nhất và Metadata công ty
#                 sql_latest = """
#                 SELECT 
#                     i.id as instrument_id, 
#                     i.symbol, 
#                     cp.company_name,
#                     d.open as open_price, 
#                     d.close as current_price, 
#                     d.volume
#                 FROM instrument_data d
#                 JOIN instrument_periods p ON p.id = d.instrument_period_id
#                 JOIN instruments i ON i.id = p.instrument_id
#                 LEFT JOIN company_profile cp ON cp.symbol = i.symbol
#                 INNER JOIN (
#                     SELECT instrument_period_id, MAX(timestamps) as max_ts
#                     FROM instrument_data GROUP BY instrument_period_id
#                 ) latest ON d.instrument_period_id = latest.instrument_period_id 
#                   AND d.timestamps = latest.max_ts
#                 WHERE p.period = 'daily';
#                 """
#                 cur.execute(sql_latest)
#                 rows = cur.fetchall()

#                 # Khởi tạo Redis Pipeline để tối ưu tốc độ ghi
#                 pipe = self.r.pipeline()
#                 pipe.delete(self.heatmap_key)
#                 pipe.delete(self.mcap_ranking_key)
#                 pipe.delete(self.liq_ranking_key)
#                 pipe.delete(self.change_ranking_key)

#                 for row in rows:
#                     symbol = row['symbol'].upper()
#                     price = self.safe_float(row['current_price'])
#                     open_p = self.safe_float(row['open_price'])
#                     volume = self.safe_float(row['volume'])
#                     company_name = row['company_name'] or symbol
                    
#                     # --- A. TÍNH TOÁN THANH KHOẢN ---
#                     liquidity = price * volume
                    
#                     # --- B. LẤY MARKET CAP VỚI LOGIC DỰ PHÒNG (FALLBACK) ---
#                     market_cap = 0
#                     try:
#                         ticker = yf.Ticker(symbol)
#                         # Lấy info một lần duy nhất để tránh gọi API nhiều lần
#                         info = ticker.info
                        
#                         # 1. Thử lấy marketCap trực tiếp
#                         m_cap = self.safe_float(info.get('marketCap'))
                        
#                         # 2. Nếu = 0, thử tính thủ công: Price * Shares Outstanding
#                         if m_cap == 0:
#                             shares = self.safe_float(info.get('sharesOutstanding'))
#                             m_cap = price * shares
                        
#                         # 3. Nếu vẫn = 0 (thường là quỹ ETF), lấy Total Assets
#                         if m_cap == 0:
#                             m_cap = self.safe_float(info.get('totalAssets'))
                            
#                         market_cap = m_cap
#                     except Exception:
#                         market_cap = 0

#                     # --- C. TÍNH % BIẾN ĐỘNG GIÁ ---
#                     change_pct = 0.0
#                     if open_p > 0:
#                         change_pct = round(((price - open_p) / open_p * 100), 2)

#                     # --- D. CẬP NHẬT MYSQL SNAPSHOT ---
#                     sql_snapshot = """
#                         INSERT INTO instrument_snapshot 
#                             (instrument_id, symbol, open, price, volume, liquidity, market_cap, change_pct, updated_at)
#                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
#                         ON DUPLICATE KEY UPDATE 
#                             price = VALUES(price), 
#                             volume = VALUES(volume),
#                             liquidity = VALUES(liquidity), 
#                             market_cap = VALUES(market_cap), 
#                             change_pct = VALUES(change_pct), 
#                             updated_at = NOW();
#                     """
#                     cur.execute(sql_snapshot, (
#                         row['instrument_id'], symbol, open_p, price, volume, 
#                         liquidity, market_cap, change_pct
#                     ))

#                     # --- E. ĐẨY DỮ LIỆU VÀO REDIS ---
#                     pipe.zadd(self.mcap_ranking_key, {symbol: market_cap})
#                     pipe.zadd(self.liq_ranking_key, {symbol: liquidity})
#                     pipe.zadd(self.change_ranking_key, {symbol: change_pct})

#                     # Size ô vuông tỷ lệ với log10 Market Cap (cho Heatmap đẹp hơn)
#                     size = round(math.log10(max(market_cap, 1)), 2)
#                     color = '#27ae60' if change_pct >= 2.5 else '#9be7c4' if change_pct > 0 else '#c0392b' if change_pct <= -2.5 else '#f5b7b1'
                    
#                     heatmap_item = {
#                         'symbol': symbol,
#                         'name': company_name,
#                         'price': price,
#                         'market_cap': market_cap,
#                         'liquidity': liquidity,
#                         'change_pct': change_pct,
#                         'size': size,
#                         'color': color
#                     }
#                     pipe.hset(self.heatmap_key, symbol, json.dumps(heatmap_item))
                    
#                     # 💡 Mẹo: Nghỉ 0.5s để tránh bị Yahoo khóa IP nếu số lượng mã quá lớn
#                     time.sleep(0.5) 

#                 # Thực thi và đặt thời gian hết hạn (24h)
#                 pipe.expire(self.heatmap_key, 86400)
#                 pipe.expire(self.mcap_ranking_key, 86400)
#                 pipe.execute()
                
#                 print(f"✅ Đồng bộ hoàn tất {len(rows)} mã chứng khoán.")

#             conn.close()
#         except Exception as e:
#             print(f"❌ Lỗi nghiêm trọng: {e}")

# if __name__ == "__main__":
#     MarketSyncService().sync()

import os
import sys
import pymysql
import redis
import json
import math
import yfinance as yf
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from config.settings import settings


class MarketSyncService:
    def __init__(self):
        self.db_config = settings.DB_CONFIG.copy()
        self.db_config['cursorclass'] = pymysql.cursors.DictCursor

        self.r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=getattr(settings, 'REDIS_PASSWORD', None),
            decode_responses=True
        )

        self.heatmap_key = 'heatmap:daily'
        self.mcap_ranking_key = 'marketcap:ranking:daily'
        self.liq_ranking_key = 'liquidity:ranking:daily'
        self.change_ranking_key = 'heatmap:ranking:change'
        self.ttl = 86400

        # cache market cap trong 1 lần sync để tránh gọi Yahoo lặp lại
        self.market_cap_cache = {}

    def safe_float(self, value):
        try:
            return float(value) if value is not None else 0.0
        except (ValueError, TypeError):
            return 0.0

    def calc_size(self, market_cap: float) -> float:
        return round(math.log10(max(market_cap, 1)), 2)

    def calc_color(self, change_pct: float) -> str:
        if change_pct >= 2.5:
            return '#27ae60'
        if change_pct > 0:
            return '#9be7c4'
        if change_pct <= -2.5:
            return '#c0392b'
        return '#f5b7b1'

    def fetch_market_cap(self, symbol: str, price: float) -> float:
        if symbol in self.market_cap_cache:
            return self.market_cap_cache[symbol]

        market_cap = 0.0
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info or {}

            market_cap = self.safe_float(info.get('marketCap'))
            if market_cap <= 0:
                shares = self.safe_float(info.get('sharesOutstanding'))
                if shares > 0:
                    market_cap = price * shares

            if market_cap <= 0:
                market_cap = self.safe_float(info.get('totalAssets'))
        except Exception:
            market_cap = 0.0

        self.market_cap_cache[symbol] = market_cap
        return market_cap

    def sync(self):
        conn = None
        try:
            conn = pymysql.connect(**self.db_config)
            conn.autocommit(True)

            with conn.cursor() as cur:
                print(f"--- SYNCING MARKET DATA: {datetime.now()} ---")

                # latest daily row cho mỗi instrument
                # volume_latest: volume của row latest
                # volume_fallback: volume daily gần nhất > 0
                sql_latest = """
                SELECT
                    i.id AS instrument_id,
                    UPPER(TRIM(i.symbol)) AS symbol,
                    cp.company_name,
                    d.open AS open_price,
                    d.close AS current_price,
                    d.volume AS volume_latest,
                    (
                        SELECT d2.volume
                        FROM instrument_data d2
                        JOIN instrument_periods p2 ON p2.id = d2.instrument_period_id
                        WHERE p2.instrument_id = i.id
                          AND p2.period = 'daily'
                          AND d2.volume IS NOT NULL
                          AND d2.volume > 0
                        ORDER BY d2.timestamps DESC
                        LIMIT 1
                    ) AS volume_fallback,
                    s.market_cap AS snapshot_market_cap
                FROM instrument_data d
                JOIN instrument_periods p
                    ON p.id = d.instrument_period_id
                JOIN instruments i
                    ON i.id = p.instrument_id
                LEFT JOIN company_profile cp
                    ON UPPER(TRIM(cp.symbol)) = UPPER(TRIM(i.symbol))
                LEFT JOIN instrument_snapshot s
                    ON s.instrument_id = i.id
                INNER JOIN (
                    SELECT instrument_period_id, MAX(timestamps) AS max_ts
                    FROM instrument_data
                    GROUP BY instrument_period_id
                ) latest
                    ON d.instrument_period_id = latest.instrument_period_id
                   AND d.timestamps = latest.max_ts
                WHERE p.period = 'daily';
                """
                cur.execute(sql_latest)
                rows = cur.fetchall()

                pipe = self.r.pipeline()
                pipe.delete(self.heatmap_key)
                pipe.delete(self.mcap_ranking_key)
                pipe.delete(self.liq_ranking_key)
                pipe.delete(self.change_ranking_key)

                sql_snapshot = """
                    INSERT INTO instrument_snapshot
                        (instrument_id, symbol, open, price, volume, liquidity, market_cap, change_pct, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        symbol = VALUES(symbol),
                        open = VALUES(open),
                        price = VALUES(price),
                        volume = VALUES(volume),
                        liquidity = VALUES(liquidity),
                        market_cap = VALUES(market_cap),
                        change_pct = VALUES(change_pct),
                        updated_at = NOW()
                """

                processed = 0
                skipped = 0

                for row in rows:
                    instrument_id = row['instrument_id']
                    symbol = (row.get('symbol') or '').strip().upper()
                    if not symbol:
                        skipped += 1
                        continue

                    company_name = row.get('company_name') or symbol

                    price = self.safe_float(row.get('current_price'))
                    open_p = self.safe_float(row.get('open_price'))

                    volume_latest = self.safe_float(row.get('volume_latest'))
                    volume_fallback = self.safe_float(row.get('volume_fallback'))

                    # Fix liquidity = 0:
                    # ưu tiên volume latest, nếu latest <= 0 thì lấy volume gần nhất > 0
                    volume = volume_latest if volume_latest > 0 else volume_fallback

                    if price <= 0:
                        skipped += 1
                        continue

                    liquidity = price * volume if volume > 0 else 0.0

                    change_pct = 0.0
                    if open_p > 0:
                        change_pct = round(((price - open_p) / open_p) * 100, 2)

                    snapshot_market_cap = self.safe_float(row.get('snapshot_market_cap'))
                    if snapshot_market_cap > 0:
                        market_cap = snapshot_market_cap
                    else:
                        market_cap = self.fetch_market_cap(symbol, price)

                    cur.execute(sql_snapshot, (
                        instrument_id,
                        symbol,
                        open_p,
                        price,
                        volume,
                        liquidity,
                        market_cap,
                        change_pct
                    ))

                    pipe.zadd(self.mcap_ranking_key, {symbol: market_cap})
                    pipe.zadd(self.liq_ranking_key, {symbol: liquidity})
                    pipe.zadd(self.change_ranking_key, {symbol: change_pct})

                    heatmap_item = {
                        'symbol': symbol,
                        'name': company_name,
                        'price': price,
                        'market_cap': market_cap,
                        'liquidity': liquidity,
                        'change_pct': change_pct,
                        'size': self.calc_size(market_cap),
                        'color': self.calc_color(change_pct)
                    }
                    pipe.hset(self.heatmap_key, symbol, json.dumps(heatmap_item))

                    processed += 1

                pipe.expire(self.heatmap_key, self.ttl)
                pipe.expire(self.mcap_ranking_key, self.ttl)
                pipe.expire(self.liq_ranking_key, self.ttl)
                pipe.expire(self.change_ranking_key, self.ttl)
                pipe.execute()

                print(f"SYNC DONE: processed={processed}, skipped={skipped}, total={len(rows)}")

        except Exception as e:
            print(f"SYNC ERROR: {e}")
        finally:
            if conn:
                conn.close()


if __name__ == "__main__":
    MarketSyncService().sync()