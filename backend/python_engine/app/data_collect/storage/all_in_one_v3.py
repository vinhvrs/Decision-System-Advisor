import yfinance as yf
import requests
import uuid
import pymysql
import time
import re
import hashlib
import calendar
from datetime import datetime, timedelta
from newspaper import Article
from config.settings import Config

# Đảm bảo hàm calculate_price_impact của bạn ở file pipeline_processor.py 
# đã được cập nhật để trả về 4 giá trị: pre, post, trade_date, elapsed
from app.pipeline.pipeline_processor import calculate_price_impact

# ==========================================
# 0. FILTERING & DEDUPLICATION ENGINE (NON-AI)
# ==========================================

BLACKLIST = re.compile(
    r'(?i)(zacks rank|should you buy|stock of the day|market wrap|what to watch|'
    r'opinion|dow jones|s&p 500|wall street fell|wall street hits|buy or sell|'
    r'is it too late|top stocks|stocks to watch)'
)

EVENT_TRIGGERS = re.compile(
    r'(?i)(earnings|revenue|guidance|q[1-4]|dividend|launches|unveils|'
    r'acquires|merger|partnership|secures|resigns|steps down|lawsuit|sued|'
    r'fda approval|layoffs|cuts jobs|bankruptcy)'
)

def is_valuable_event(title, symbol, company_name):
    """Hard filter: Kiểm tra giá trị của bài báo dựa trên Tiêu đề"""
    if not title: 
        return False
    
    title_lower = title.lower()
    symbol_lower = symbol.lower()
    short_name = company_name.split()[0].lower() 

    # 1. Bắt buộc chứa Ticker hoặc Tên công ty (chữ đầu)
    if not (re.search(rf'\b{symbol_lower}\b', title_lower) or short_name in title_lower):
        return False
        
    # 2. Bỏ qua các tin rác, tổng hợp, clickbait
    if BLACKLIST.search(title_lower):
        return False
        
    # 3. Bắt buộc phải là sự kiện tài chính (có chứa keyword hành động)
    if not EVENT_TRIGGERS.search(title_lower):
        return False
        
    return True

def get_jaccard_similarity(text1: str, text2: str) -> float:
    """Tính độ tương đồng toán học (Jaccard)"""
    set1 = set(re.findall(r'\w+', str(text1).lower()))
    set2 = set(re.findall(r'\w+', str(text2).lower()))
    if not set1 or not set2: 
        return 0.0
    return len(set1.intersection(set2)) / len(set1.union(set2))

def deduplicate_news(articles: list, threshold: float = 0.45) -> list:
    """Gộp các bài báo có nội dung/tiêu đề giống nhau"""
    unique_events = []
    for article in articles:
        is_duplicate = False
        for unique_event in unique_events:
            sim_score = get_jaccard_similarity(article['title'], unique_event['title'])
            if sim_score >= threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            unique_events.append(article)
    return unique_events

def extract_pattern_type(title):
    """Gắn tag sự kiện cho bài báo"""
    title_lower = title.lower()
    patterns = {
        'EARNINGS': r'\b(earnings|q[1-4]|revenue|guidance)\b',
        'PRODUCT': r'\b(launches|unveils|releases|new product)\b',
        'M&A': r'\b(acquires|merger|partnership|takeover)\b',
        'REGULATORY': r'\b(fda|lawsuit|sec|sued|investigation)\b',
        'MACRO': r'\b(fed|interest rate|inflation|cpi)\b',
        'MANAGEMENT': r'\b(ceo|resigns|steps down|layoffs)\b'
    }
    for p_type, regex in patterns.items():
        if re.search(regex, title_lower):
            return p_type
    return 'GENERAL'

# ==========================================
# 1. DATABASE HELPERS (FIXED & ENGLISH)
# ==========================================

def get_db_connection():
    """Safety check for multiple cursorclass arguments"""
    db_params = Config.DB_CONFIG.copy()
    if 'cursorclass' not in db_params:
        db_params['cursorclass'] = pymysql.cursors.DictCursor
    return pymysql.connect(**db_params)

def get_all_companies():
    """Fetch symbols and names from company_profile"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT symbol, company_name FROM company_profile")
            return cursor.fetchall()
    finally:
        conn.close()

def save_to_knowledge_docs(doc_id, symbol, title, content, published_at, url):
    """Lưu toàn văn bài báo vào knowledge_docs_temp sau khi đã lọc. 
       Lưu ý: Bảng này dùng cột 'source' để chứa URL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Lưu URL vào cột source để khớp với Database hiện tại
            sql = """INSERT IGNORE INTO knowledge_docs_temp 
                     (id, symbol, title, content, published_at, source, is_processed)
                     VALUES (%s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (
                doc_id, symbol, title, content, published_at, url, 1
            ))
        conn.commit()
    finally:
        conn.close()

def save_to_inference_results(event, source_name="GDELT"):
    """Saves analyzed news directly to knowledge_inference_results"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if event['candles_elapsed'] < 7:
                rec = "Maybe up trend" if event['pre_trend'] > 0 else "Maybe down trend"
                status = "PENDING"
            else:
                rec = "BUY" if event['post_trend'] > 1.5 else ("SELL" if event['post_trend'] < -1.5 else "HOLD")
                status = "COMPLETED"

            sql = """INSERT IGNORE INTO knowledge_inference_results 
                     (id, symbol, doc_id, title, published_at, pre_trend, post_trend, recommendation, pattern_type, status, candles_elapsed)
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (
                str(uuid.uuid4()), event['symbol'], event.get('doc_id', '0'), event['title'][:450],
                event['published_at'], event['pre_trend'], event['post_trend'], 
                rec, event.get('pattern_type', 'GENERAL'), status, event.get('candles_elapsed', 0)
            ))
        conn.commit()
    finally:
        conn.close()

# ==========================================
# 2. CONTENT PARSER & FALLBACKS
# ==========================================

def fetch_content_waterfall(url, title):
    """
    Tries multiple libraries to extract full article text.
    Returns (content_string, publish_date)
    """
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) > 150:
            return article.text, article.publish_date
    except: 
        pass

    return f"News Brief: {title}. Full article content available at: {url}", None

# ==========================================
# 3. MULTI-SOURCE FETCHING (GDELT, FINNHUB, YFINANCE)
# ==========================================

def fetch_and_fill_window(symbol, company_name, start_dt, end_dt):
    """Sliding window for GDELT: Breaks 1 year into 30-day chunks."""
    print(f"🪟 Sliding Window: {start_dt.date()} <--- {end_dt.date()}")
    
    current_chunk_end = end_dt
    while current_chunk_end > start_dt:
        current_chunk_start = max(current_chunk_end - timedelta(days=30), start_dt)
        print(f"   🔍 Scanning GDELT: {current_chunk_start.date()} to {current_chunk_end.date()}")
        
        params = {
            "query": f'"{company_name}" stock',
            "mode": "ArtList", "maxrecords": 75, "format": "json",
            "startdatetime": current_chunk_start.strftime('%Y%m%d%H%M%S'),
            "enddatetime": current_chunk_end.strftime('%Y%m%d%H%M%S')
        }

        # Header giả lập trình duyệt Chrome để tránh bị chặn IP
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # Chiến lược "Deep Sleep" chống HTTP 429
        max_retries = 3
        success = False
        res = None
        
        for attempt in range(max_retries):
            try:
                res = requests.get(
                    "https://api.gdeltproject.org/api/v2/doc/doc", 
                    params=params, 
                    headers=headers,
                    timeout=45
                )

                if res.status_code == 429:
                    # GDELT đang hét lên "Chậm lại!" -> Phải ngủ đông ít nhất 5 phút (300 giây)
                    sleep_time = 300 * (attempt + 1) 
                    print(f"      🛑 [HTTP 429] Bị chặn Rate Limit! Hệ thống tự động NGỦ ĐÔNG {sleep_time/60} phút để xả block...")
                    time.sleep(sleep_time)
                    raise requests.exceptions.RequestException("HTTP 429 Too Many Requests")

                elif res.status_code != 200:
                    print(f"      ⚠️ API trả về mã lỗi HTTP {res.status_code}. Thử lại...")
                    raise requests.exceptions.RequestException(f"HTTP {res.status_code}")
                    
                success = True
                break # Thành công thì thoát vòng lặp
                
            except requests.exceptions.RequestException as e:
                if "429" not in str(e): # Tránh log lặp lại nếu đã log ở trên
                    wait_time = 10 * (attempt + 1)
                    print(f"      ⚠️ API Timeout/Reset (Thử lại {attempt+1}/{max_retries} sau {wait_time}s)... Lỗi: {e}")
                    time.sleep(wait_time)
                
        if not success or res is None or res.status_code != 200:
            print(f"      ❌ Bỏ qua chunk {current_chunk_start.date()} do lỗi API liên tục.")
            current_chunk_end = current_chunk_start - timedelta(seconds=1)
            continue
            
        try:
            articles = res.json().get('articles', [])
            valid_articles = []
            
            # --- BƯỚC 1: LỌC RÁC ---
            for art in articles:
                title = art.get('title', '')
                if is_valuable_event(title, symbol, company_name):
                    try:
                        pub_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                        valid_articles.append({
                            'title': title,
                            'url': art.get('url'),
                            'published_at': pub_date
                        })
                    except: 
                        continue
            
            # --- BƯỚC 2: GỘP TRÙNG LẶP ---
            unique_articles = deduplicate_news(valid_articles)
            print(f"      📥 Found {len(articles)} raw -> Filtered {len(valid_articles)} -> Kept {len(unique_articles)} unique events.")

            # --- BƯỚC 3: LẤY TEXT, LƯU VÀO DOCS VÀ TÍNH TOÁN ---
            for art in unique_articles:
                print(f"      📖 Fetching text: {art['title'][:50]}...")
                content, _ = fetch_content_waterfall(art['url'], art['title'])
                
                if not content or len(content) < 100:
                    continue
                    
                doc_id = str(uuid.uuid4())
                
                # Lưu toàn văn (truyền URL vào cột source bên trong hàm)
                save_to_knowledge_docs(
                    doc_id=doc_id, 
                    symbol=symbol, 
                    title=art['title'], 
                    content=content, 
                    published_at=art['published_at'], 
                    url=art['url']
                )

                # Tính biến động
                pre, post, trade_date, elapsed = calculate_price_impact(art['published_at'], symbol)
                
                if trade_date:
                    pattern = extract_pattern_type(art['title'])
                    # Lưu inference
                    save_to_inference_results({
                        'doc_id': doc_id,
                        'symbol': symbol,
                        'title': art['title'],
                        'published_at': art['published_at'],
                        'pre_trend': pre,
                        'post_trend': post,
                        'pattern_type': pattern,
                        'candles_elapsed': elapsed
                    }, source_name="GDELT")
        
        except Exception as e:
            print(f"   ⚠️ Parsing Error: {e}")
            
        # TĂNG ĐỘ TRỄ LÊN 15 GIÂY: Để cào mượt mà suốt đêm mà không bị block
        time.sleep(15) 
        current_chunk_end = current_chunk_start - timedelta(seconds=1)

def fetch_corporate_actions(symbol, company_name):
    print(f"   📊 Fetching Corporate Actions for {symbol}...")
    try:
        tk = yf.Ticker(symbol)
        actions = tk.actions
        if not actions.empty:
            for date, row in actions.iterrows():
                etype = "Dividend" if row['Dividends'] > 0 else "Stock Split"
                val = row['Dividends'] if etype == "Dividend" else row['Stock Splits']
                title = f"[{symbol}] Corporate Action: {etype} of {val}"
                
                impact_result = calculate_price_impact(date, symbol)
                if len(impact_result) == 4:
                    pre, post, trade_date, elapsed = impact_result
                else:
                    pre, post, trade_date = impact_result
                    elapsed = 7

                if trade_date:
                    doc_id = str(uuid.uuid4())
                    
                    # Lưu sự kiện YFinance vào docs luôn cho đồng bộ
                    save_to_knowledge_docs(
                        doc_id=doc_id, symbol=symbol, title=title, 
                        content=f"Official corporate action data from Yahoo Finance: {etype} of {val}", 
                        published_at=date, url="YFinance_Action"
                    )

                    save_to_inference_results({
                        'doc_id': doc_id,
                        'symbol': symbol, 
                        'title': title,
                        'published_at': date, 
                        'pre_trend': pre, 
                        'post_trend': post,
                        'pattern_type': 'CORPORATE_ACTION',
                        'candles_elapsed': elapsed
                    }, source_name="YFinance")
    except Exception as e:
        print(f"   ⚠️ Corporate Action Error: {e}")

# ==========================================
# 4. LINEAR DEEP FILL PROCESS
# ==========================================

def run_deep_fill_process(limit_year=2018):
    companies = get_all_companies()
    if not companies:
        print("❌ No companies found in database.")
        return

    for co in companies:
        symbol = co['symbol']
        print(f"\n{'='*60}")
        print(f"🚀 STARTING LINEAR BACKFILL: {symbol}")

        fetch_corporate_actions(symbol, co['company_name'])

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # SỬA LỖI MSFT 1987: Loại trừ sự kiện cổ tức khi tìm ngày cũ nhất
                cursor.execute("""
                    SELECT MIN(published_at) as oldest 
                    FROM knowledge_inference_results 
                    WHERE symbol = %s AND pattern_type != 'CORPORATE_ACTION'
                """, (symbol,))
                res = cursor.fetchone()
                current_end = res['oldest'] if res and res['oldest'] else datetime.now()
        finally:
            conn.close()

        target_limit = datetime(limit_year, 1, 1)
        print(f"📅 Current Oldest: {current_end.date()} | Target: {limit_year}")

        while current_end > target_limit:
            current_start = current_end - timedelta(days=365)
            fetch_and_fill_window(symbol, co['company_name'], current_start, current_end)
            
            current_end = current_start
            print(f"✅ Year block completed. Moving back from {current_end.date()}...")
            time.sleep(3)

if __name__ == "__main__":
    run_deep_fill_process(limit_year=2018)