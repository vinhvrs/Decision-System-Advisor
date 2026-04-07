import yfinance as yf
import requests
import uuid
import pymysql
import time
import hashlib
from datetime import datetime
from newspaper import Article
from config.settings import Config

def get_all_companies():
    """Symbols and names from company_profile (limited by TOP_N)."""
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            query = "SELECT symbol, company_name FROM company_profile LIMIT %s"
            cursor.execute(query, (Config.TOP_N,))
            return cursor.fetchall() 
    finally:
        conn.close()

def generate_hash_key(symbol, dt, source, title):
    """MD5 dedupe key; source is typically the article URL."""
    s = str(symbol or 'UNKNOWN').upper()
    d = dt.strftime('%Y-%m-%d') if dt else '0000-00-00'
    src = str(source or 'UNKNOWN').lower()
    t = str(title or '').strip().lower()[:100]
    
    unique_str = f"{s}|{d}|{src}|{t}"
    return hashlib.md5(unique_str.encode('utf-8')).hexdigest()

def fetch_article_content(url):
    """Download article text and publish date via newspaper3k."""
    try:
        article = Article(url)
        article.download()
        article.parse()
        # text + parsed publish date
        return article.text, article.publish_date
    except Exception as e:
        return None, None

def insert_to_temp(data_list):
    """INSERT IGNORE into knowledge_docs."""
    if not data_list: return 0
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            # URL lives in source column only
            sql = """INSERT IGNORE INTO knowledge_docs
                     (id, hash_key, title, content, published_at, image, category, symbol, source, author, language, created_at, updated_at, is_processed)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.executemany(sql, data_list)
            conn.commit()
            return cursor.rowcount
    finally:
        conn.close()

def backfill_data(ticker_symbol, company_name):
    print(f"\n[crawl] {ticker_symbol} - {company_name}")
    payload = []
    now = datetime.now()

    # 1) YFinance corporate actions
    try:
        tk = yf.Ticker(ticker_symbol)
        actions = tk.actions[tk.actions.index >= "2000-01-01"]
        for date, row in actions.iterrows():
            div = row.get('Dividends', 0)
            split = row.get('Stock Splits', 0)
            etype = "Dividend" if div > 0 else "Stock Split"
            val = div if div > 0 else split
            
            title = f"[{ticker_symbol}] {etype}"
            # Yahoo quote URL as source
            event_url = f"https://finance.yahoo.com/quote/{ticker_symbol}"
            h_key = generate_hash_key(ticker_symbol, date, event_url, title)
            
            payload.append((
                str(uuid.uuid4()),
                h_key,
                title,
                f"Corporate action: {company_name} ({ticker_symbol}) {etype} value {val}.",
                date,
                None,
                "report",
                ticker_symbol,
                event_url,
                "System-Quant",
                "en",
                now,
                now,
                0,
            ))
    except Exception as e: 
        print(f"  [WARN] YFinance: {e}")

    # 2) GDELT + full-text fetch
    params = {
        "query": f'"{company_name}" stock', "mode": "ArtList", 
        "maxrecords": 20, "format": "json", "startdatetime": "20230101000000" 
    }
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}

    try:
        time.sleep(7)  # reduce 429 risk
        res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, headers=headers, timeout=20)
        
        if res.status_code == 200:
            articles = res.json().get('articles', [])
            print(f"  [gdelt] {len(articles)} URLs; fetching bodies...")
            
            for art in articles:
                url = art.get('url', '')
                title = art.get('title', 'No Title')
                
                content, p_date = fetch_article_content(url)
                
                if not p_date:
                    try:
                        p_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                    except:
                        p_date = now

                # Hash includes URL as source
                h_key = generate_hash_key(ticker_symbol, p_date, url, title)
                final_content = content if content and len(content) > 50 else f"Summary: {title}. Link: {url}"
                
                payload.append((
                    str(uuid.uuid4()),
                    h_key,
                    title[:450],
                    final_content,
                    p_date,
                    None,
                    "article",
                    ticker_symbol,
                    url,
                    "GDELT",
                    "en",
                    now,
                    now,
                    0,
                ))
                time.sleep(10)
        elif res.status_code == 429:
            print("  [gdelt] HTTP 429; skipping symbol.")
    except Exception as e:
        print(f"  [WARN] GDELT/crawl: {e}")

    if payload:
        new_records = insert_to_temp(payload)
        print(f"  [db] inserted {new_records} rows ({len(payload) - new_records} duplicates skipped).")
    else:
        print("  [WARN] Nothing to insert.")

if __name__ == "__main__":
    print("--- Crawler: full content + hash dedupe ---")
    companies = get_all_companies()
    
    for co in companies:
        backfill_data(co['symbol'], co['company_name'])
        time.sleep(3)