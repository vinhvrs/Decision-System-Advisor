import yfinance as yf
import requests
import uuid
import pymysql
import time
import hashlib
from datetime import datetime, timedelta
import calendar
from newspaper import Article
from config.settings import Config

# --- DB helpers ---

def get_all_companies():
    """Load symbols and company names from company_profile."""
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            query = "SELECT symbol, company_name FROM company_profile LIMIT %s"
            cursor.execute(query, (Config.TOP_N,))
            return cursor.fetchall() 
    finally:
        conn.close()

def generate_hash_key(symbol, dt, source, title):
    """MD5 dedupe key from symbol, date, source URL, title prefix."""
    s = str(symbol or 'UNKNOWN').upper()
    d = dt.strftime('%Y-%m-%d') if dt else '0000-00-00'
    src = str(source or 'UNKNOWN').lower()
    t = str(title or '').strip().lower()[:100]
    return hashlib.md5(f"{s}|{d}|{src}|{t}".encode('utf-8')).hexdigest()

def insert_to_temp(data_list):
    """Bulk insert into knowledge_docs (INSERT IGNORE)."""
    if not data_list: return 0
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            sql = """INSERT IGNORE INTO knowledge_docs
                     (id, hash_key, title, content, published_at, image, category, symbol, source, author, language, created_at, updated_at, is_processed)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.executemany(sql, data_list)
            conn.commit()
            return cursor.rowcount
    finally:
        conn.close()

# --- Time chunking and article parsing ---

def generate_time_chunks(start_year, end_year, interval='month'):
    """
    Build (start, end) datetime ranges from start_year through now.
    interval: 'year', 'month', or 'week'.
    """
    chunks = []
    start_dt = datetime(start_year, 1, 1)
    end_dt = datetime.now()

    current = start_dt
    while current <= end_dt:
        if interval == 'year':
            next_dt = datetime(current.year, 12, 31, 23, 59, 59)
        elif interval == 'month':
            last_day = calendar.monthrange(current.year, current.month)[1]
            next_dt = datetime(current.year, current.month, last_day, 23, 59, 59)
        elif interval == 'week':
            next_dt = current + timedelta(days=6, hours=23, minutes=59, seconds=59)
        else:
            raise ValueError("interval must be 'year', 'month', or 'week'")

        if next_dt > end_dt:
            next_dt = end_dt

        chunks.append((current, next_dt))
        current = next_dt + timedelta(seconds=1)
        
        # Stop once we pass end_dt
        if current > end_dt:
            break
            
    return chunks

def fetch_article_content(url):
    """Try newspaper3k, then news-please."""
    # 1) newspaper3k
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) > 100:
            return article.text, article.publish_date
    except: pass

    # 2) news-please
    try:
        from newsplease import NewsPlease
        art = NewsPlease.from_url(url, timeout=15)
        if art and art.maintext and len(art.maintext) > 100:
            return art.maintext, art.date_publish
    except: pass

    return None, None

def process_and_append(payload, symbol, title, url, raw_dt, source_name):
    """Fetch article body and append one knowledge_docs row tuple to payload."""
    if not title or not url: return
    content, p_date = fetch_article_content(url)
    final_date = p_date if p_date else (raw_dt or datetime.now())
    
    h_key = generate_hash_key(symbol, final_date, url, title)
    final_content = content if content else f"Brief: {title}. Read more: {url}"
    
    _n = datetime.now()
    payload.append((
        str(uuid.uuid4()),
        h_key,
        title[:450],
        final_content,
        final_date,
        None,
        "article",
        symbol,
        url,
        source_name,
        "en",
        _n,
        _n,
        0,
    ))

# --- Main backfill (2000 -> now) ---

def backfill_data(ticker_symbol, company_name):
    print(f"\n{'='*50}\n[crawl] {ticker_symbol} - {company_name}\n{'='*50}")
    payload = []
    now = datetime.now()

    # 1) YFinance corporate actions since 2000
    try:
        print("  [1/5] YFinance (2000 -> now)...")
        tk = yf.Ticker(ticker_symbol)
        for date, row in tk.actions[tk.actions.index >= "2000-01-01"].iterrows():
            div, split = row.get('Dividends', 0), row.get('Stock Splits', 0)
            etype = "Dividend" if div > 0 else "Stock Split"
            val = div if div > 0 else split
            title = f"[{ticker_symbol}] {etype}"
            url = f"https://finance.yahoo.com/quote/{ticker_symbol}"
            
            payload.append((
                str(uuid.uuid4()),
                generate_hash_key(ticker_symbol, date, url, title),
                title,
                f"{company_name} ({ticker_symbol}) {etype} value {val}.",
                date,
                None,
                "report",
                ticker_symbol,
                url,
                "System-YFinance",
                "en",
                now,
                now,
                0,
            ))
    except Exception as e: print(f"  [WARN] YFinance: {e}")

    # 2) GDELT yearly chunks
    print("  [2/5] GDELT (yearly chunks)...")
    # Use interval 'month' or 'week' for finer coverage (slower)
    gdelt_chunks = generate_time_chunks(2000, now.year, interval='year') 
    
    for start_dt, end_dt in gdelt_chunks:
        try:
            start_str = start_dt.strftime('%Y%m%d%H%M%S')
            end_str = end_dt.strftime('%Y%m%d%H%M%S')
            
            params = {
                "query": f'"{company_name}" stock', "mode": "ArtList", 
                "maxrecords": 10, "format": "json",  # raise to 50-100 for more rows
                "startdatetime": start_str, "enddatetime": end_str
            }
            res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            
            if res.status_code == 200:
                articles = res.json().get('articles', [])
                if articles: print(f"     + GDELT {start_dt.strftime('%Y-%m')}..{end_dt.strftime('%Y-%m')}: {len(articles)} URLs")
                for art in articles:
                    try: dt = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('url'), dt, 'GDELT')
                    time.sleep(0.3)
            elif res.status_code == 429:
                print(f"     [WARN] GDELT 429; sleep 15s")
                time.sleep(15)
            
            time.sleep(2)
        except Exception as e: print(f"  [WARN] GDELT chunk: {e}")

    # 3) Finnhub (yearly)
    if getattr(Config, 'FINNHUB_KEY', None):
        print("  [3/5] Finnhub (yearly chunks)...")
        # Free tier: start 2023; use 2000 with a paid plan
        finnhub_chunks = generate_time_chunks(2023, now.year, interval='year')
        for start_dt, end_dt in finnhub_chunks:
            try:
                s_str, e_str = start_dt.strftime('%Y-%m-%d'), end_dt.strftime('%Y-%m-%d')
                res = requests.get(f"https://finnhub.io/api/v1/company-news?symbol={ticker_symbol}&from={s_str}&to={e_str}&token={Config.FINNHUB_KEY}", timeout=10)
                if res.status_code == 200:
                    articles = res.json()
                    if articles: print(f"     + Finnhub {s_str[:4]}: {len(articles[:10])} headlines (top 10)")
                    for art in articles[:10]:
                        process_and_append(payload, ticker_symbol, art.get('headline'), art.get('url'), datetime.fromtimestamp(art.get('datetime', now.timestamp())), 'Finnhub')
                time.sleep(1.5)
            except Exception as e: print(f"  [WARN] Finnhub chunk: {e}")

    # 4-5) Recent news only APIs
    print("  [4/5] NewsAPI (recent)...")
    if getattr(Config, 'NEWSAPIORG_KEY', None):
        try:
            res = requests.get(f"https://newsapi.org/v2/everything?q={ticker_symbol} stock&language=en&sortBy=publishedAt&apiKey={Config.NEWSAPIORG_KEY}", timeout=10)
            if res.status_code == 200:
                for art in res.json().get('articles', [])[:15]:
                    try: dt = datetime.strptime(art['publishedAt'], '%Y-%m-%dT%H:%M:%SZ')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('url'), dt, 'NewsAPI')
        except Exception: pass

    print("  [5/5] NewsData.io (recent)...")
    if getattr(Config, 'NEWSDATA_KEY', None):
        try:
            res = requests.get(f"https://newsdata.io/api/1/news?apikey={Config.NEWSDATA_KEY}&q={ticker_symbol}&language=en", timeout=10)
            if res.status_code == 200:
                for art in res.json().get('results', [])[:15]:
                    try: dt = datetime.strptime(art['pubDate'], '%Y-%m-%d %H:%M:%S')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('link'), dt, 'NewsData')
        except Exception: pass

    if payload:
        new_records = insert_to_temp(payload)
        print(f"\n  [done] {ticker_symbol}: inserted {new_records} rows ({len(payload) - new_records} duplicates skipped).")
    else:
        print("\n  [WARN] No rows to insert.")

if __name__ == "__main__":
    print("======================================================")
    print("All-in-one crawler (time-chunked backfill)")
    print("Sources: YFinance, Finnhub, NewsAPI, NewsData, GDELT")
    print("Parser: newspaper3k -> news-please fallback")
    print("======================================================")
    
    companies = get_all_companies()
    for co in companies:
        backfill_data(co['symbol'], co['company_name'])
        time.sleep(5)