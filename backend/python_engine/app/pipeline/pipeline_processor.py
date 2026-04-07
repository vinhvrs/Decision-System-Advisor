import pymysql
import pandas as pd
import uuid
import json
import re
from datetime import timedelta, datetime
from config.settings import Config 

def fetch_price_window(symbol, pub_date):
    conn = pymysql.connect(**Config.DB_CONFIG)
    start_search = (pub_date - timedelta(days=45)).strftime('%Y-%m-%d')
    end_search = (pub_date + timedelta(days=45)).strftime('%Y-%m-%d')
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            query = """
                SELECT timestamps as timestamp, close 
                FROM instrument_data 
                WHERE slug LIKE %s AND timestamps BETWEEN %s AND %s
                ORDER BY timestamps ASC
            """
            cursor.execute(query, (f"{symbol.lower()}-daily-%", start_search, end_search))
            rows = cursor.fetchall()
            df = pd.DataFrame(rows)
    finally: conn.close()
    
    if not df.empty:
        first_val = str(df['timestamp'].iloc[0])
        unit = 's' if first_val.isnumeric() and len(first_val) > 10 else None
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit=unit).dt.date
        df = df.drop_duplicates(subset=['timestamp']).reset_index(drop=True)
    return df

def calculate_price_impact(pub_date, symbol):
    """Return pre/post returns, trade date, and elapsed candle count."""
    price_df = fetch_price_window(symbol, pub_date)
    if price_df.empty: return 0.0, 0.0, None, 0
    
    target_date = pub_date + timedelta(days=1) if pub_date.hour >= 16 else pub_date
    target_date = target_date.date()
    future_candles = price_df[price_df['timestamp'] >= target_date]
    
    if future_candles.empty:
        idx = len(price_df) - 1
        is_future = True
    else:
        idx = future_candles.index[0]
        is_future = False
        
    actual_trade_date = price_df.iloc[idx]['timestamp']
    if abs((actual_trade_date - target_date).days) > 7: return 0.0, 0.0, None, 0
    
    curr_p = float(price_df.iloc[idx]['close'])
    pre_idx = max(0, idx - 14)
    pre_p = float(price_df.iloc[pre_idx]['close'])
    pre_ret = round(((curr_p - pre_p) / pre_p) * 100, 2) if pre_p > 0 else 0.0
    
    post_ret = 0.0
    candles_elapsed = 0
    
    if not is_future:
        available_post_candles = len(price_df) - 1 - idx
        candles_elapsed = min(7, available_post_candles)
        
        if candles_elapsed > 0:
            post_idx = idx + candles_elapsed
            post_p = float(price_df.iloc[post_idx]['close'])
            post_ret = round(((post_p - curr_p) / curr_p) * 100, 2) if curr_p > 0 else 0.0
            
    return pre_ret, post_ret, str(actual_trade_date), candles_elapsed

def extract_pattern_type(title, content=""):
    """Classify headline/body with fixed regex rules (no LLM)."""
    text = f"{title} {content}".lower()
    
    patterns = {
        'EARNINGS': r'\b(earnings|q[1-4]|revenue|guidance)\b',
        'PRODUCT': r'\b(launches|unveils|releases|new product)\b',
        'M&A': r'\b(acquires|merger|partnership|takeover)\b',
        'REGULATORY': r'\b(fda|lawsuit|sec|sued|investigation)\b',
        'MACRO': r'\b(fed|interest rate|inflation|cpi)\b',
        'MANAGEMENT': r'\b(ceo|resigns|steps down|layoffs)\b'
    }
    
    for p_type, regex in patterns.items():
        if re.search(regex, text):
            return p_type
            
    return 'GENERAL'

def get_last_processed_timestamp(symbol):
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor: 
            # Schema includes pattern_type, status, candles_elapsed
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_inference_results (
                    id VARCHAR(50) PRIMARY KEY, symbol VARCHAR(20), doc_id VARCHAR(50),
                    title TEXT, published_at DATETIME, pre_trend FLOAT,
                    post_trend FLOAT, recommendation VARCHAR(50), 
                    pattern_type VARCHAR(50) DEFAULT 'GENERAL',
                    status VARCHAR(20) DEFAULT 'PENDING',
                    candles_elapsed INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("SELECT MAX(published_at) as max_pub FROM knowledge_inference_results WHERE symbol = %s", (symbol,))
            res = cursor.fetchone()
            if res and res['max_pub']:
                return res['max_pub']
            return datetime(2000, 1, 1)
    finally: conn.close()

def get_initial_recommendation(pre_trend):
    """Initial recommendation at T=0 from pre-trend only."""
    if pre_trend > 2.0:
        return "Maybe up trend, should Buy"
    elif pre_trend < -2.0:
        return "Maybe down trend, should Sell"
    return "Not enough to compare, should Hold"

def process_docs_to_chunks(target_symbol=None, test_mode=False):
    last_time = get_last_processed_timestamp(target_symbol)
    print(f"[pipeline] Checking new docs for {target_symbol} since {last_time}")
    conn = pymysql.connect(**Config.DB_CONFIG)
    impactful_events = [] 
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Include content for pattern_type extraction
            sql = "SELECT id as doc_id, symbol, title, content, published_at FROM knowledge_docs WHERE symbol = %s AND published_at > %s ORDER BY published_at ASC"
            cursor.execute(sql, (target_symbol, last_time))
            docs = cursor.fetchall()
            if not docs: return []
            
            print(f"[pipeline] Processing {len(docs)} new article(s)...")
            
            for doc in docs:
                pre, post, t_date, elapsed = calculate_price_impact(doc['published_at'], doc['symbol'])
                pattern = extract_pattern_type(doc['title'], doc['content'])
                
                if t_date:
                    if elapsed < 7:
                        rec = get_initial_recommendation(pre)
                        status = 'PENDING'
                    else:
                        rec = "BUY" if post > 1.5 else ("SELL" if post < -1.5 else "HOLD")
                        status = 'COMPLETED'
                        
                    event = {
                        'id': str(uuid.uuid4()), 'symbol': doc['symbol'], 'doc_id': doc['doc_id'],
                        'title': doc['title'], 'published_at': doc['published_at'],
                        'trade_date': t_date, 'pre_trend': pre, 'post_trend': post,
                        'pattern_type': pattern, 'status': status, 'candles_elapsed': elapsed
                    }
                    impactful_events.append(event)
                    
                    if not test_mode:
                        cursor.execute("""
                            INSERT IGNORE INTO knowledge_inference_results 
                            (id, symbol, doc_id, title, published_at, pre_trend, post_trend, recommendation, pattern_type, status, candles_elapsed)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (event['id'], event['symbol'], event['doc_id'], event['title'], event['published_at'], pre, post, rec, pattern, status, elapsed))
                        
                        cursor.execute("UPDATE knowledge_docs SET is_processed = 1 WHERE id = %s", (doc['doc_id'],))
            conn.commit()
            return impactful_events
    except Exception as e:
        print(f"[pipeline] Error: {e}"); return []
    finally: conn.close()

def update_rolling_trends():
    """Daily job: refresh post_trend and mark rows COMPLETED when window elapsed."""
    print("[pipeline] Updating rolling window (pending rows)...")
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, symbol, published_at, recommendation FROM knowledge_inference_results WHERE status = 'PENDING'")
            pending_events = cursor.fetchall()
            
            updated_count = 0
            completed_count = 0
            
            for ev in pending_events:
                pre, post, t_date, elapsed = calculate_price_impact(ev['published_at'], ev['symbol'])
                
                if elapsed > 0:
                    real_rec = "BUY" if post > 1.5 else ("SELL" if post < -1.5 else "HOLD")
                else:
                    real_rec = ev['recommendation'] 
                
                new_status = 'COMPLETED' if elapsed >= 7 else 'PENDING'
                
                cursor.execute("""
                    UPDATE knowledge_inference_results 
                    SET post_trend = %s, recommendation = %s, status = %s, candles_elapsed = %s
                    WHERE id = %s
                """, (post, real_rec, new_status, elapsed, ev['id']))
                
                if new_status == 'COMPLETED':
                    completed_count += 1
                updated_count += 1
                
            conn.commit()
            print(f"[pipeline] Updated {updated_count} PENDING row(s); marked COMPLETED: {completed_count}.")
    except Exception as e:
        print(f"[pipeline] Rolling update error: {e}")
    finally: conn.close()