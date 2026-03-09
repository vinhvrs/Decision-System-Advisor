# import yfinance as yf
# import requests
# import uuid
# import pymysql
# import time
# import hashlib
# from datetime import datetime, timedelta
# import calendar
# from newspaper import Article
# from config.settings import Config

# # ==========================================
# # 1. DATABASE & LOGIC HỖ TRỢ (FIXED KEYERROR)
# # ==========================================

# def get_all_companies():
#     """Lấy danh sách các mã chứng khoán cần crawl từ DB"""
#     conn = pymysql.connect(**Config.DB_CONFIG)
#     try:
#         with conn.cursor(pymysql.cursors.DictCursor) as cursor:
#             # Lấy toàn bộ mã trong bảng profile
#             cursor.execute("SELECT symbol, company_name FROM company_profile")
#             return cursor.fetchall()
#     finally:
#         conn.close()

# def generate_hash_key(url):
#     """Tạo key duy nhất dựa trên URL để tránh trùng lặp bài báo"""
#     return hashlib.md5(url.encode('utf-8')).hexdigest()

# def insert_to_temp(payload):
#     """Lưu dữ liệu vào bảng knowledge_docs_temp"""
#     if not payload: return 0
#     conn = pymysql.connect(**Config.DB_CONFIG)
#     inserted_count = 0
#     try:
#         with conn.cursor() as cursor:
#             sql = """INSERT IGNORE INTO knowledge_docs_temp 
#                      (hash_key, symbol, title, content, published_at, source, url, is_processed) 
#                      VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
#             cursor.executemany(sql, payload)
#             inserted_count = cursor.rowcount
#         conn.commit()
#     finally:
#         conn.close()
#     return inserted_count

# def fetch_article_content(url):
#     """Sử dụng newspaper3k để lấy nội dung bài báo từ URL"""
#     try:
#         article = Article(url)
#         article.download()
#         article.parse()
#         return article.text if len(article.text) > 100 else None
#     except:
#         return None

# def process_and_append(payload, symbol, title, url, pub_date, source):
#     """Xử lý thô, cào nội dung và đưa vào hàng chờ lưu DB"""
#     if not url or not title: return
    
#     hash_key = generate_hash_key(url)
#     content = fetch_article_content(url)
    
#     if content:
#         payload.append((
#             hash_key, symbol, title, content, 
#             pub_date.strftime('%Y-%m-%d %H:%M:%S'), 
#             source, url, 0
#         ))

# # ==========================================
# # 2. LOGIC TÌM KHOẢNG TRỐNG (FIXED KEYERROR)
# # ==========================================

# def get_oldest_pub_date(symbol):
#     """Tìm ngày đăng bài cũ nhất của symbol này trong DB"""
#     conn = pymysql.connect(**Config.DB_CONFIG)
#     try:
#         # Sử dụng DictCursor và Alias 'oldest' để tránh KeyError: 0
#         with conn.cursor(pymysql.cursors.DictCursor) as cursor:
#             query = "SELECT MIN(published_at) as oldest FROM knowledge_docs_temp WHERE symbol = %s"
#             cursor.execute(query, (symbol,))
#             res = cursor.fetchone()
            
#             if res and res['oldest']:
#                 return res['oldest']
#             return datetime.now()
#     finally:
#         conn.close()

# def check_data_gap(symbol, target_date, days_window=30):
#     """Kiểm tra xem trong khoảng days_window trước target_date có tin nào chưa"""
#     conn = pymysql.connect(**Config.DB_CONFIG)
#     try:
#         start_check = target_date - timedelta(days=days_window)
#         with conn.cursor(pymysql.cursors.DictCursor) as cursor:
#             # Sử dụng Alias 'total' để tránh KeyError: 0
#             query = """SELECT COUNT(*) as total FROM knowledge_docs_temp 
#                        WHERE symbol = %s AND published_at BETWEEN %s AND %s"""
#             cursor.execute(query, (symbol, start_check, target_date))
#             res = cursor.fetchone()
            
#             if res:
#                 return res['total'] > 0
#             return False
#     finally:
#         conn.close()

# def generate_backward_chunks(end_dt, years_back=1):
#     """Tạo các mốc thời gian lùi dần về quá khứ, mỗi chunk 1 tháng"""
#     chunks = []
#     limit_dt = end_dt - timedelta(days=365 * years_back)
#     current_end = end_dt
#     while current_end > limit_dt:
#         days_in_month = calendar.monthrange(current_end.year, current_end.month)[1]
#         current_start = current_end - timedelta(days=days_in_month)
#         chunks.append((current_start, current_end))
#         current_end = current_start - timedelta(seconds=1)
#     return chunks

# # ==========================================
# # 3. LUỒNG CRAWL BACKFILL CHIỀU SÂU
# # ==========================================

# def deep_backfill(ticker_symbol, company_name):
#     print(f"\n{'='*60}")
#     print(f"🕵️ ĐANG TRUY VẾT QUÁ KHỨ: {ticker_symbol}")
    
#     oldest_dt = get_oldest_pub_date(ticker_symbol)
#     print(f"📅 Mốc cũ nhất hiện có: {oldest_dt.strftime('%Y-%m-%d')}")

#     # Kiểm tra xem có bị thủng dữ liệu không
#     has_recent_past = check_data_gap(ticker_symbol, oldest_dt)
#     if not has_recent_past:
#         print(f"⚠️ Phát hiện khoảng trống trước {oldest_dt.date()}. Bắt đầu lấp đầy...")
    
#     # Tạo chu kỳ lùi 1 năm từ mốc cũ nhất
#     work_chunks = generate_backward_chunks(oldest_dt, years_back=1)

#     payload = []

#     for s_dt, e_dt in work_chunks:
#         print(f"🔍 Quét GDELT: {s_dt.date()} ➡️ {e_dt.date()}")
#         try:
#             params = {
#                 "query": f'"{company_name}" stock',
#                 "mode": "ArtList", "maxrecords": 50, "format": "json",
#                 "startdatetime": s_dt.strftime('%Y%m%d%H%M%S'),
#                 "enddatetime": e_dt.strftime('%Y%m%d%H%M%S')
#             }
#             res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, timeout=20)
            
#             if res.status_code == 200:
#                 data = res.json()
#                 articles = data.get('articles', [])
#                 print(f"   📊 Tìm thấy {len(articles)} URLs")
#                 for art in articles:
#                     try: dt = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
#                     except: dt = s_dt
#                     process_and_append(payload, ticker_symbol, art.get('title'), art.get('url'), dt, 'GDELT_BACKFILL')
#                     time.sleep(0.1)
            
#             # Lưu theo lô nhỏ
#             if len(payload) >= 5:
#                 inserted = insert_to_temp(payload)
#                 print(f"   💾 Đã lưu {inserted} bản tin vào DB.")
#                 payload = []
                
#             time.sleep(2) # Tránh bị GDELT block
#         except Exception as e:
#             print(f"   ❌ Lỗi tại chunk {s_dt.date()}: {e}")

#     # Lưu nốt bản ghi còn lại
#     if payload:
#         insert_to_temp(payload)
#     print(f"🏁 Hoàn thành phiên Backfill cho {ticker_symbol}")

# # ==========================================
# # CHƯƠNG TRÌNH CHÍNH
# # ==========================================

# if __name__ == "__main__":
#     companies = get_all_companies()
#     if not companies:
#         print("⚠️ Database trống! Hãy kiểm tra bảng company_profile.")
    
#     for co in companies:
#         deep_backfill(co['symbol'], co['company_name'])
#         print(f"☕ Nghỉ 10s chuyển sang mã tiếp theo...")
#         time.sleep(10)

import yfinance as yf
import requests
import uuid
import pymysql
import time
import hashlib
import calendar
from datetime import datetime, timedelta
from newspaper import Article
from config.settings import Config
from app.pipeline.pipeline_processor import calculate_price_impact

# ==========================================
# 1. DATABASE HELPERS (FIXED MULTIPLE CURSORCLASS)
# ==========================================

def get_db_connection():
    # Kiểm tra nếu trong Config đã có cursorclass thì không truyền thêm nữa
    db_params = Config.DB_CONFIG.copy()
    if 'cursorclass' not in db_params:
        db_params['cursorclass'] = pymysql.cursors.DictCursor
    return pymysql.connect(**db_params)

def get_all_companies():
    """Lấy danh sách các mã chứng khoán cần crawl từ DB"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT symbol, company_name FROM company_profile")
            return cursor.fetchall()
    finally:
        conn.close()

def save_to_inference_results(event):
    """Nối trực tiếp kết quả vào bảng knowledge_inference_results"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Phân loại recommendation cơ bản
            rec = "HOLD"
            if event['post_trend'] > 1.5: rec = "BUY"
            elif event['post_trend'] < -1.5: rec = "SELL"

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

# ==========================================
# 2. SLIDING WINDOW LOGIC (TRƯỢT LÙI 1 NĂM)
# ==========================================

def fetch_and_fill_window(symbol, company_name, start_dt, end_dt):
    """
    Quét GDELT trong cửa sổ 1 năm, chia nhỏ từng tháng để đảm bảo 
    tính liên tục, không bị nhảy vọt thông tin.
    """
    print(f"🪟 Sliding Window: {start_dt.date()} ⬅️ {end_dt.date()}")
    
    current_chunk_end = end_dt
    while current_chunk_end > start_dt:
        # Chia nhỏ mỗi lần quét 30 ngày để GDELT trả về đầy đủ nhất
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
                print(f"   📊 [{current_chunk_start.date()}] Tìm thấy {len(articles)} tin.")
                
                for art in articles:
                    try:
                        pub_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                        
                        # Tính toán tác động giá từ pipeline_processor
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
                    except: continue
            
            time.sleep(1.5) # Tránh bị GDELT từ chối (Rate limit)
        except Exception as e:
            print(f"   ❌ Lỗi tại chunk {current_chunk_start.date()}: {e}")
            
        current_chunk_end = current_chunk_start - timedelta(seconds=1)

# ==========================================
# 3. LUỒNG TRUY VẾT TUYẾN TÍNH (LINEAR BACKWARD)
# ==========================================

def run_deep_fill_process(limit_year=2020):
    """
    Tiến trình chính: Tìm điểm 'thủng' cũ nhất và lùi dần về quá khứ.
    """
    companies = get_all_companies()
    if not companies:
        print("⚠️ Không có mã chứng khoán nào để xử lý.")
        return

    for co in companies:
        symbol = co['symbol']
        print(f"\n{'='*60}")
        print(f"🕵️ BẮT ĐẦU FILL DỮ LIỆU TUYẾN TÍNH: {symbol}")

        # Tìm mốc cũ nhất trong bảng result để làm điểm bắt đầu lùi
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT MIN(published_at) as oldest FROM knowledge_inference_results WHERE symbol = %s", (symbol,))
                res = cursor.fetchone()
                # Nếu DB trống, lấy mốc hiện tại
                current_end = res['oldest'] if res and res['oldest'] else datetime.now()
        finally:
            conn.close()

        target_limit = datetime(limit_year, 1, 1)
        print(f"📅 Mốc hiện tại: {current_end.date()} | Mục tiêu lùi về: {limit_year}")

        # Trượt lùi cửa sổ 1 năm mỗi bước
        while current_end > target_limit:
            current_start = current_end - timedelta(days=365)
            
            fetch_and_fill_window(symbol, co['company_name'], current_start, current_end)
            
            current_end = current_start
            print(f"✅ Hoàn thành khối 1 năm. Đang lùi tiếp từ mốc {current_end.date()}...")
            time.sleep(5)

if __name__ == "__main__":
    # Điền dữ liệu lùi về năm 2018 (Không nhảy vọt)
    run_deep_fill_process(limit_year=2018)
    
# =====================================================================================
# import yfinance as yf
# import requests
# import uuid
# import pymysql
# import time
# import hashlib
# import calendar
# from datetime import datetime, timedelta
# from newspaper import Article
# from config.settings import Config
# from app.pipeline.pipeline_processor import calculate_price_impact

# # ==========================================
# # 1. DATABASE HELPERS (FIXED & ENGLISH)
# # ==========================================

# def get_db_connection():
#     """Safety check for multiple cursorclass arguments"""
#     db_params = Config.DB_CONFIG.copy()
#     if 'cursorclass' not in db_params:
#         db_params['cursorclass'] = pymysql.cursors.DictCursor
#     return pymysql.connect(**db_params)

# def get_all_companies():
#     """Fetch symbols and names from company_profile"""
#     conn = get_db_connection()
#     try:
#         with conn.cursor() as cursor:
#             cursor.execute("SELECT symbol, company_name FROM company_profile")
#             return cursor.fetchall()
#     finally:
#         conn.close()

# def save_to_inference_results(event, source_name="GDELT"):
#     """Saves analyzed news directly to knowledge_inference_results"""
#     conn = get_db_connection()
#     try:
#         with conn.cursor() as cursor:
#             # Classification in English
#             rec = "HOLD"
#             if event['post_trend'] > 1.5: rec = "BUY"
#             elif event['post_trend'] < -1.5: rec = "SELL"

#             sql = """INSERT IGNORE INTO knowledge_inference_results 
#                      (id, symbol, doc_id, title, published_at, pre_trend, post_trend, recommendation)
#                      VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
#             cursor.execute(sql, (
#                 str(uuid.uuid4()), event['symbol'], 0, event['title'][:450],
#                 event['published_at'], event['pre_trend'], event['post_trend'], rec
#             ))
#         conn.commit()
#     finally:
#         conn.close()

# # ==========================================
# # 2. CONTENT PARSER & FALLBACKS
# # ==========================================

# def fetch_content_waterfall(url, title):
#     """
#     Tries multiple libraries to extract full article text.
#     Returns (content_string, publish_date)
#     """
#     # Fallback 1: Newspaper3k
#     try:
#         article = Article(url)
#         article.download()
#         article.parse()
#         if article.text and len(article.text) > 150:
#             return article.text, article.publish_date
#     except: pass

#     # Fallback 2: Brief English Summary
#     return f"News Brief: {title}. Full article content available at: {url}", None

# # ==========================================
# # 3. MULTI-SOURCE FETCHING (GDELT, FINNHUB, YFINANCE)
# # ==========================================

# def fetch_and_fill_window(symbol, company_name, start_dt, end_dt):
#     """
#     Sliding window for GDELT: Breaks 1 year into 30-day chunks.
#     """
#     print(f"🪟 Sliding Window: {start_dt.date()} <--- {end_dt.date()}")
    
#     current_chunk_end = end_dt
#     while current_chunk_end > start_dt:
#         current_chunk_start = max(current_chunk_end - timedelta(days=30), start_dt)
#         print(f"   🔍 Scanning GDELT: {current_chunk_start.date()} to {current_chunk_end.date()}")
        
#         params = {
#             "query": f'"{company_name}" stock',
#             "mode": "ArtList", "maxrecords": 75, "format": "json",
#             "startdatetime": current_chunk_start.strftime('%Y%m%d%H%M%S'),
#             "enddatetime": current_chunk_end.strftime('%Y%m%d%H%M%S')
#         }
        
#         try:
#             res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, timeout=30)
#             if res.status_code == 200:
#                 articles = res.json().get('articles', [])
#                 for art in articles:
#                     try:
#                         pub_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
#                         pre, post, trade_date = calculate_price_impact(pub_date, symbol)
                        
#                         if trade_date:
#                             save_to_inference_results({
#                                 'symbol': symbol,
#                                 'title': art.get('title'),
#                                 'published_at': pub_date,
#                                 'pre_trend': pre,
#                                 'post_trend': post
#                             })
#                     except: continue
#             time.sleep(1.5) 
#         except Exception as e:
#             print(f"   ⚠️ GDELT Chunk Error: {e}")
            
#         current_chunk_end = current_chunk_start - timedelta(seconds=1)

# def fetch_corporate_actions(symbol, company_name):
#     """Fetches Dividends/Splits as significant events"""
#     print(f"   📊 Fetching Corporate Actions for {symbol}...")
#     try:
#         tk = yf.Ticker(symbol)
#         actions = tk.actions
#         if not actions.empty:
#             for date, row in actions.iterrows():
#                 etype = "Dividend" if row['Dividends'] > 0 else "Stock Split"
#                 val = row['Dividends'] if etype == "Dividend" else row['Stock Splits']
#                 title = f"[{symbol}] Corporate Action: {etype} of {val}"
                
#                 pre, post, trade_date = calculate_price_impact(date, symbol)
#                 if trade_date:
#                     save_to_inference_results({
#                         'symbol': symbol, 'title': title,
#                         'published_at': date, 'pre_trend': pre, 'post_trend': post
#                     }, source_name="YFinance")
#     except: pass

# # ==========================================
# # 4. LINEAR DEEP FILL PROCESS
# # ==========================================

# def run_deep_fill_process(limit_year=2018):
#     """
#     Main Process: Finds the oldest record and moves backward linearly.
#     """
#     companies = get_all_companies()
#     if not companies:
#         print("❌ No companies found in database.")
#         return

#     for co in companies:
#         symbol = co['symbol']
#         print(f"\n{'='*60}")
#         print(f"🚀 STARTING LINEAR BACKFILL: {symbol}")

#         # Get Corporate Actions first
#         fetch_corporate_actions(symbol, co['company_name'])

#         # Find starting point for news backfill
#         conn = get_db_connection()
#         try:
#             with conn.cursor() as cursor:
#                 cursor.execute("SELECT MIN(published_at) as oldest FROM knowledge_inference_results WHERE symbol = %s", (symbol,))
#                 res = cursor.fetchone()
#                 current_end = res['oldest'] if res and res['oldest'] else datetime.now()
#         finally:
#             conn.close()

#         target_limit = datetime(limit_year, 1, 1)
#         print(f"📅 Current Oldest: {current_end.date()} | Target: {limit_year}")

#         # Sliding Window 1 year at a time
#         while current_end > target_limit:
#             current_start = current_end - timedelta(days=365)
#             fetch_and_fill_window(symbol, co['company_name'], current_start, current_end)
            
#             current_end = current_start
#             print(f"✅ Year block completed. Moving back from {current_end.date()}...")
#             time.sleep(3)

# if __name__ == "__main__":
#     # Fill data backward to 2018 in a full English, linear fashion
#     run_deep_fill_process(limit_year=2018)