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
        self.fear_greed_key = 'fear_greed:by_symbol:daily'
        self.ttl = 86400

        # Per-sync Yahoo market cap cache (avoid repeat calls)
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

    @staticmethod
    def fear_greed_label(score: int) -> str:
        if score <= 24:
            return 'Extreme Fear'
        if score <= 44:
            return 'Fear'
        if score <= 55:
            return 'Neutral'
        if score <= 74:
            return 'Greed'
        return 'Extreme Greed'

    def calc_fear_greed_per_symbol(self, change_pct: float):
        """
        Same per-symbol index as the Next.js beginner hover strip:
        F = round(clamp[0,100](50 + 3.25 * r)), r = daily snapshot % change (open -> close).
        """
        try:
            r = float(change_pct)
        except (TypeError, ValueError):
            return 50, 'Neutral'
        if not math.isfinite(r):
            return 50, 'Neutral'
        raw = 50.0 + r * 3.25
        v = int(round(max(0.0, min(100.0, raw))))
        return v, self.fear_greed_label(v)

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

                # Latest daily row per instrument:
                # volume_latest = volume on latest row; volume_fallback = most recent daily volume > 0
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
                    s.market_cap AS snapshot_market_cap,
                    (
                        SELECT AVG(x.vol)
                        FROM (
                            SELECT d3.volume AS vol
                            FROM instrument_data d3
                            INNER JOIN instrument_periods p3 ON p3.id = d3.instrument_period_id
                            WHERE p3.instrument_id = i.id
                              AND p3.period = 'daily'
                              AND d3.volume IS NOT NULL
                              AND d3.volume > 0
                            ORDER BY d3.timestamps DESC
                            LIMIT 20
                        ) AS x
                    ) AS avg_volume_20d
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
                pipe.delete(self.fear_greed_key)

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

                    # Snapshot volume column: prefer latest-row volume; if zero use last positive daily volume
                    volume = volume_latest if volume_latest > 0 else volume_fallback

                    if price <= 0:
                        skipped += 1
                        continue

                    avg_volume_20d = self.safe_float(row.get('avg_volume_20d'))
                    # Liquidity = price * 20d average daily volume (shares); 0 if no avg yet
                    liquidity = price * avg_volume_20d if avg_volume_20d > 0 else 0.0

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

                    fg_val, fg_label = self.calc_fear_greed_per_symbol(change_pct)
                    fg_payload = {
                        'value': fg_val,
                        'label': fg_label,
                        'change_pct': change_pct,
                    }
                    pipe.hset(self.fear_greed_key, symbol, json.dumps(fg_payload))

                    heatmap_item = {
                        'symbol': symbol,
                        'name': company_name,
                        'price': price,
                        'market_cap': market_cap,
                        'liquidity': liquidity,
                        'change_pct': change_pct,
                        'fear_greed': fg_val,
                        'fear_greed_label': fg_label,
                        'avg_volume_20d': avg_volume_20d,
                        'size': self.calc_size(market_cap),
                        'color': self.calc_color(change_pct)
                    }
                    pipe.hset(self.heatmap_key, symbol, json.dumps(heatmap_item))

                    processed += 1

                pipe.expire(self.heatmap_key, self.ttl)
                pipe.expire(self.mcap_ranking_key, self.ttl)
                pipe.expire(self.liq_ranking_key, self.ttl)
                pipe.expire(self.change_ranking_key, self.ttl)
                pipe.expire(self.fear_greed_key, self.ttl)
                pipe.execute()

                print(f"SYNC DONE: processed={processed}, skipped={skipped}, total={len(rows)}")

        except Exception as e:
            print(f"SYNC ERROR: {e}")
        finally:
            if conn:
                conn.close()


if __name__ == "__main__":
    MarketSyncService().sync()