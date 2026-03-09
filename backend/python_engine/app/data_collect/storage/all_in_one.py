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

# ==========================================
# 1. CÁC HÀM TIỆN ÍCH & DATABASE
# ==========================================

def get_all_companies():
    """Lấy danh sách công ty từ DB"""
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            query = "SELECT symbol, company_name FROM company_profile LIMIT %s"
            cursor.execute(query, (Config.TOP_N,))
            return cursor.fetchall() 
    finally:
        conn.close()

def generate_hash_key(symbol, dt, source, title):
    """Băm MD5 để chống trùng lặp tuyệt đối"""
    s = str(symbol or 'UNKNOWN').upper()
    d = dt.strftime('%Y-%m-%d') if dt else '0000-00-00'
    src = str(source or 'UNKNOWN').lower()
    t = str(title or '').strip().lower()[:100]
    return hashlib.md5(f"{s}|{d}|{src}|{t}".encode('utf-8')).hexdigest()

def insert_to_temp(data_list):
    """Nạp dữ liệu vào DB"""
    if not data_list: return 0
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            sql = """INSERT IGNORE INTO knowledge_docs_temp 
                     (id, hash_key, symbol, title, content, published_at, category, source, author, language, created_at, is_processed) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.executemany(sql, data_list)
            conn.commit()
            return cursor.rowcount
    finally:
        conn.close()

# ==========================================
# 2. HÀM CHUNKING THỜI GIAN & PARSER
# ==========================================

def generate_time_chunks(start_year, end_year, interval='month'):
    """
    Tự động chia nhỏ thời gian từ start_year đến end_year.
    Hỗ trợ interval: 'year', 'month', 'week'
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
            raise ValueError("Interval chỉ hỗ trợ: 'year', 'month', 'week'")

        if next_dt > end_dt:
            next_dt = end_dt

        chunks.append((current, next_dt))
        current = next_dt + timedelta(seconds=1)
        
        # Nếu đã vượt qua thời điểm hiện tại thì dừng
        if current > end_dt:
            break
            
    return chunks

def fetch_article_content(url):
    """Cơ chế Parser Thác Nước (Waterfall)"""
    # 1. Thử newspaper3k
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) > 100:
            return article.text, article.publish_date
    except: pass

    # 2. Thử news-please (Viện binh từ Github)
    try:
        from newsplease import NewsPlease
        art = NewsPlease.from_url(url, timeout=15)
        if art and art.maintext and len(art.maintext) > 100:
            return art.maintext, art.date_publish
    except: pass

    return None, None

def process_and_append(payload, symbol, title, url, raw_dt, source_name):
    """Xử lý nội dung và đóng gói Payload"""
    if not title or not url: return
    content, p_date = fetch_article_content(url)
    final_date = p_date if p_date else (raw_dt or datetime.now())
    
    h_key = generate_hash_key(symbol, final_date, url, title)
    final_content = content if content else f"Tin vắn: {title}. Đọc thêm tại: {url}"
    
    payload.append((
        str(uuid.uuid4()), h_key, symbol, title[:450],
        final_content, final_date, 'article', url, 
        source_name, 'en', datetime.now(), 0
    ))

# ==========================================
# 3. LUỒNG CRAWL CHÍNH (BACKFILL 2000 - NAY)
# ==========================================

def backfill_data(ticker_symbol, company_name):
    print(f"\n{'='*50}\n🚀 ĐANG XỬ LÝ: {ticker_symbol} - {company_name}\n{'='*50}")
    payload = []
    now = datetime.now()

    # --- 1. YFINANCE (Từ 2000 đến nay) ---
    try:
        print("  📊 [1/5] Đang quét YFinance (2000 - Hiện tại)...")
        tk = yf.Ticker(ticker_symbol)
        for date, row in tk.actions[tk.actions.index >= "2000-01-01"].iterrows():
            div, split = row.get('Dividends', 0), row.get('Stock Splits', 0)
            etype = "Dividend" if div > 0 else "Stock Split"
            val = div if div > 0 else split
            title = f"[{ticker_symbol}] {etype}"
            url = f"https://finance.yahoo.com/quote/{ticker_symbol}"
            
            payload.append((
                str(uuid.uuid4()), generate_hash_key(ticker_symbol, date, url, title), 
                ticker_symbol, title,
                f"{company_name} ({ticker_symbol}) thực hiện {etype} mức {val}.",
                date, 'report', url, 'System-YFinance', 'en', now, 0
            ))
    except Exception as e: print(f"  ⚠️ YFinance Error: {e}")

    # --- 2. GDELT (Backfill với Time Chunking) ---
    print("  🔍 [2/5] Đang quét GDELT (Chia chunk theo NĂM)...")
    # Thay đổi 'year' thành 'month' hoặc 'week' nếu bạn muốn vét siêu sạch (Tốn time chạy)
    gdelt_chunks = generate_time_chunks(2000, now.year, interval='year') 
    
    for start_dt, end_dt in gdelt_chunks:
        try:
            start_str = start_dt.strftime('%Y%m%d%H%M%S')
            end_str = end_dt.strftime('%Y%m%d%H%M%S')
            
            params = {
                "query": f'"{company_name}" stock', "mode": "ArtList", 
                "maxrecords": 10, "format": "json", # Tăng maxrecords lên 50-100 nếu cần nhiều
                "startdatetime": start_str, "enddatetime": end_str
            }
            res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            
            if res.status_code == 200:
                articles = res.json().get('articles', [])
                if articles: print(f"     + GDELT ({start_dt.strftime('%Y-%m')} tới {end_dt.strftime('%Y-%m')}): Tìm thấy {len(articles)} URLs")
                for art in articles:
                    try: dt = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('url'), dt, 'GDELT')
                    time.sleep(0.3) # Nghỉ khi cào nội dung
            elif res.status_code == 429:
                print(f"     ⚠️ GDELT Rate Limit, nghỉ 15s...")
                time.sleep(15)
            
            time.sleep(2) # Nghỉ giữa các Chunks
        except Exception as e: print(f"  ⚠️ GDELT Chunk Error: {e}")

    # --- 3. FINNHUB (Backfill Chunking) ---
    if getattr(Config, 'FINNHUB_KEY', None):
        print("  🔍 [3/5] Đang quét Finnhub (Chia chunk theo NĂM)...")
        # Bản Free giới hạn, nên mình set quét từ 2023. Đổi 2023 thành 2000 nếu bạn có gói Premium.
        finnhub_chunks = generate_time_chunks(2023, now.year, interval='year')
        for start_dt, end_dt in finnhub_chunks:
            try:
                s_str, e_str = start_dt.strftime('%Y-%m-%d'), end_dt.strftime('%Y-%m-%d')
                res = requests.get(f"https://finnhub.io/api/v1/company-news?symbol={ticker_symbol}&from={s_str}&to={e_str}&token={Config.FINNHUB_KEY}", timeout=10)
                if res.status_code == 200:
                    articles = res.json()
                    if articles: print(f"     + Finnhub ({s_str[:4]}): Tìm thấy {len(articles[:10])} bài (lấy top 10)")
                    for art in articles[:10]:
                        process_and_append(payload, ticker_symbol, art.get('headline'), art.get('url'), datetime.fromtimestamp(art.get('datetime', now.timestamp())), 'Finnhub')
                time.sleep(1.5) # Chống dính 60 req/min
            except Exception as e: print(f"  ⚠️ Finnhub Chunk Error: {e}")

    # --- 4 & 5. NEWSAPI & NEWSDATA (Chỉ hỗ trợ dữ liệu gần đây) ---
    print("  🔍 [4/5] Đang quét NewsAPI (Tin tức gần nhất)...")
    if getattr(Config, 'NEWSAPIORG_KEY', None):
        try:
            res = requests.get(f"https://newsapi.org/v2/everything?q={ticker_symbol} stock&language=en&sortBy=publishedAt&apiKey={Config.NEWSAPIORG_KEY}", timeout=10)
            if res.status_code == 200:
                for art in res.json().get('articles', [])[:15]:
                    try: dt = datetime.strptime(art['publishedAt'], '%Y-%m-%dT%H:%M:%SZ')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('url'), dt, 'NewsAPI')
        except Exception: pass

    print("  🔍 [5/5] Đang quét NewsData.io (Tin tức gần nhất)...")
    if getattr(Config, 'NEWSDATA_KEY', None):
        try:
            res = requests.get(f"https://newsdata.io/api/1/news?apikey={Config.NEWSDATA_KEY}&q={ticker_symbol}&language=en", timeout=10)
            if res.status_code == 200:
                for art in res.json().get('results', [])[:15]:
                    try: dt = datetime.strptime(art['pubDate'], '%Y-%m-%d %H:%M:%S')
                    except: dt = now
                    process_and_append(payload, ticker_symbol, art.get('title'), art.get('link'), dt, 'NewsData')
        except Exception: pass

    # --- NẠP DB ---
    if payload:
        new_records = insert_to_temp(payload)
        print(f"\n  ✅ TỔNG KẾT MÃ {ticker_symbol}: Nạp mới {new_records} bài (Lọc bỏ {len(payload) - new_records} bài trùng).")
    else:
        print("\n  ⚠️ Không có dữ liệu để nạp.")

if __name__ == "__main__":
    print("======================================================")
    print("🤖 HỆ THỐNG ALL-IN-ONE CRAWLER (TIME-TRAVEL CHUNKING)")
    print("Nguồn: YFinance, Finnhub, NewsAPI, NewsData, GDELT")
    print("Parser: Newspaper3k -> News-Please (Github Fallback)")
    print("======================================================")
    
    companies = get_all_companies()
    for co in companies:
        backfill_data(co['symbol'], co['company_name'])
        time.sleep(5) # Nghỉ trước khi qua mã chứng khoán khác