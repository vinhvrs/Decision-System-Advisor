import os
import sys
import pymysql
import redis
import json
import math
import time
from datetime import datetime

# Import cấu hình chuẩn theo SystemTest
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
        
        self.ranking_key = 'liquidity:ranking:daily'
        self.heatmap_key = 'heatmap:daily'

    def safe_float(self, value):
        """Chuyển đổi sang float an toàn, tránh lỗi NoneType"""
        try:
            return float(value) if value is not None else 0.0
        except (ValueError, TypeError):
            return 0.0

    def sync(self):
        try:
            conn = pymysql.connect(**self.db_config)
            conn.autocommit(True)
            
            with conn.cursor() as cur:
                print("--- 🔄 SYNCING MARKET DATA (FIXED NONETYPE) ---")

                # 1. Tính Thanh khoản 30 ngày (Khớp LiquidityService.php)
                sql_liquidity = """
                SELECT i.symbol, SUM(IFNULL(d.close, 0) * IFNULL(d.volume, 0)) as total_liquidity
                FROM instrument_data d
                JOIN instrument_periods p ON p.id = d.instrument_period_id
                JOIN instruments i ON i.id = p.instrument_id
                WHERE p.period = 'daily' 
                  AND d.timestamps >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY i.symbol;
                """
                cur.execute(sql_liquidity)
                liquidity_map = {row['symbol']: self.safe_float(row['total_liquidity']) for row in cur.fetchall()}

                # 2. Lấy nến mới nhất
                sql_latest = """
                SELECT i.symbol, i.id as instrument_id, d.open, d.close, d.volume
                FROM instrument_data d
                JOIN instrument_periods p ON p.id = d.instrument_period_id
                JOIN instruments i ON i.id = p.instrument_id
                INNER JOIN (
                    SELECT instrument_period_id, MAX(timestamps) as max_ts
                    FROM instrument_data GROUP BY instrument_period_id
                ) latest ON d.instrument_period_id = latest.instrument_period_id 
                  AND d.timestamps = latest.max_ts
                WHERE p.period = 'daily';
                """
                cur.execute(sql_latest)
                rows = cur.fetchall()

                pipe = self.r.pipeline()
                pipe.delete(self.ranking_key)
                pipe.delete(self.heatmap_key)

                for row in rows:
                    symbol = row['symbol'].upper()
                    # Sử dụng safe_float để tránh lỗi NoneType
                    price = self.safe_float(row['close'])
                    open_p = self.safe_float(row['open'])
                    vol = self.safe_float(row['volume'])
                    
                    # Lấy thanh khoản 30 ngày từ map
                    liq_30d = liquidity_map.get(symbol, 0.0)
                    
                    # Tính % thay đổi
                    change_pct = 0.0
                    if open_p > 0:
                        change_pct = round(((price - open_p) / open_p * 100), 2)

                    # --- LƯU VÀO MYSQL SNAPSHOT ---
                    sql_snapshot = """
                        INSERT INTO instrument_snapshot 
                            (instrument_id, symbol, open, price, volume, liquidity, change_pct, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE 
                            open = VALUES(open), price = VALUES(price), volume = VALUES(volume), 
                            liquidity = VALUES(liquidity), change_pct = VALUES(change_pct), updated_at = NOW();
                    """
                    cur.execute(sql_snapshot, (
                        row['instrument_id'], symbol, open_p, price, vol, liq_30d, change_pct
                    ))

                    # --- LƯU VÀO REDIS ---
                    pipe.zadd(self.ranking_key, {symbol: liq_30d})

                    size = round(math.log10(max(liq_30d, 1)), 2)
                    color = '#27ae60' if change_pct >= 3 else '#9be7c4' if change_pct > 0 else '#c0392b' if change_pct <= -3 else '#f5b7b1'
                    
                    item = {
                        'symbol': symbol,
                        'liquidity': liq_30d,
                        'change_pct': change_pct,
                        'size': size,
                        'color': color
                    }
                    pipe.hset(self.heatmap_key, symbol, json.dumps(item))

                pipe.expire(self.ranking_key, 86400)
                pipe.expire(self.heatmap_key, 86400)
                pipe.execute()
                
                print(f"✅ Đã đồng bộ {len(rows)} mã. Không còn lỗi NoneType.")
            conn.close()
        except Exception as e:
            print(f"❌ Lỗi: {e}")

if __name__ == "__main__":
    MarketSyncService().sync()