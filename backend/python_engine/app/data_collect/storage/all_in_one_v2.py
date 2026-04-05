# Linear GDELT backfill into knowledge_inference_results (legacy v2).
# For full article storage + inference, prefer all_in_one_v3.py.

import requests
import uuid
import pymysql
import time
from datetime import datetime, timedelta
from config.settings import Config
from app.pipeline.pipeline_processor import calculate_price_impact

# --- Database helpers ---

def get_db_connection():
    # Avoid passing cursorclass twice if already in Config
    db_params = Config.DB_CONFIG.copy()
    if 'cursorclass' not in db_params:
        db_params['cursorclass'] = pymysql.cursors.DictCursor
    return pymysql.connect(**db_params)

def get_all_companies():
    """Symbols to crawl from company_profile."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT symbol, company_name FROM company_profile")
            return cursor.fetchall()
    finally:
        conn.close()

def save_to_inference_results(event):
    """Insert one row into knowledge_inference_results."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Simple BUY/SELL/HOLD from post_trend
            rec = "HOLD"
            if event['post_trend'] > 1.5:
                rec = "BUY"
            elif event['post_trend'] < -1.5:
                rec = "SELL"

            sql = """INSERT IGNORE INTO knowledge_inference_results
                     (id, symbol, doc_id, title, published_at, pre_trend, post_trend, recommendation)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (
                str(uuid.uuid4()), event['symbol'], 0, event['title'],
                event['published_at'], event['pre_trend'], event['post_trend'], rec
            ))
        conn.commit()
    finally:
        conn.close()

# --- Sliding one-year window (30-day GDELT chunks) ---

def fetch_and_fill_window(symbol, company_name, start_dt, end_dt):
    """Scan GDELT in [start_dt, end_dt] using 30-day chunks."""
    print(f"[gdelt] Window {start_dt.date()} .. {end_dt.date()}")

    current_chunk_end = end_dt
    while current_chunk_end > start_dt:
        # 30-day sub-chunks for fuller GDELT responses
        current_chunk_start = max(current_chunk_end - timedelta(days=30), start_dt)

        params = {
            "query": f'"{company_name}" stock',
            "mode": "ArtList", "maxrecords": 75, "format": "json",
            "startdatetime": current_chunk_start.strftime('%Y%m%d%H%M%S'),
            "enddatetime": current_chunk_end.strftime('%Y%m%d%H%M%S')
        }

        try:
            res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, timeout=30)
            if res.status_code == 200:
                articles = res.json().get('articles', [])
                print(f"   [{current_chunk_start.date()}] {len(articles)} articles")

                for art in articles:
                    try:
                        pub_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')

                        # Price impact from pipeline_processor
                        pre, post, trade_date = calculate_price_impact(pub_date, symbol)

                        if trade_date:
                            event = {
                                'symbol': symbol,
                                'title': art.get('title'),
                                'published_at': pub_date,
                                'pre_trend': pre,
                                'post_trend': post
                            }
                            save_to_inference_results(event)
                    except Exception:
                        continue

            time.sleep(1.5)
        except Exception as e:
            print(f"   [WARN] Chunk {current_chunk_start.date()}: {e}")

        current_chunk_end = current_chunk_start - timedelta(seconds=1)

# --- Linear backward fill ---

def run_deep_fill_process(limit_year=2020):
    """Walk backward year-by-year from oldest inference row per symbol."""
    companies = get_all_companies()
    if not companies:
        print("[backfill] No symbols to process.")
        return

    for co in companies:
        symbol = co['symbol']
        print(f"\n{'='*60}")
        print(f"[backfill] Linear fill: {symbol}")

        # Oldest published_at in inference table as anchor
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT MIN(published_at) as oldest FROM knowledge_inference_results WHERE symbol = %s",
                    (symbol,),
                )
                res = cursor.fetchone()
                # No rows yet: start from now
                current_end = res['oldest'] if res and res['oldest'] else datetime.now()
        finally:
            conn.close()

        target_limit = datetime(limit_year, 1, 1)
        print(f"[backfill] Anchor {current_end.date()} | stop at year {limit_year}")

        # Step back 365 days per iteration
        while current_end > target_limit:
            current_start = current_end - timedelta(days=365)

            fetch_and_fill_window(symbol, co['company_name'], current_start, current_end)

            current_end = current_start
            print(f"[backfill] Year block done; next anchor {current_end.date()}")
            time.sleep(5)

if __name__ == "__main__":
    # Backfill down to 2018 without large time jumps
    run_deep_fill_process(limit_year=2018)
