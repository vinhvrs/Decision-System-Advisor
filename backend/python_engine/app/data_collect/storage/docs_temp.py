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
    """Lấy danh sách Ticker và Tên chính xác từ company_profile"""
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            query = "SELECT symbol, company_name FROM company_profile LIMIT %s"
            cursor.execute(query, (Config.TOP_N,))
            return cursor.fetchall() 
    finally:
        conn.close()

def generate_hash_key(symbol, dt, source, title):
    """Tạo mã MD5 chuẩn hóa để chống trùng lặp. source ở đây chính là URL"""
    s = str(symbol or 'UNKNOWN').upper()
    d = dt.strftime('%Y-%m-%d') if dt else '0000-00-00'
    src = str(source or 'UNKNOWN').lower() # URL sẽ được đưa vào đây
    t = str(title or '').strip().lower()[:100]
    
    unique_str = f"{s}|{d}|{src}|{t}"
    return hashlib.md5(unique_str.encode('utf-8')).hexdigest()

def fetch_article_content(url):
    """Cào nội dung và ngày xuất bản từ URL bài báo"""
    try:
        article = Article(url)
        article.download()
        article.parse()
        # Trả về nội dung text và ngày xuất bản
        return article.text, article.publish_date
    except Exception as e:
        return None, None

def insert_to_temp(data_list):
    """Nạp dữ liệu vào DB với cơ chế bỏ qua dòng trùng lặp"""
    if not data_list: return 0
    conn = pymysql.connect(**Config.DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            # Đã bỏ cột 'url' và chỉ giữ lại 'source' (12 cột)
            sql = """INSERT IGNORE INTO knowledge_docs_temp 
                     (id, hash_key, symbol, title, content, published_at, category, source, author, language, created_at, is_processed) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.executemany(sql, data_list)
            conn.commit()
            return cursor.rowcount
    finally:
        conn.close()

def backfill_data(ticker_symbol, company_name):
    print(f"\n🚀 [CRAWL] Đang xử lý: {ticker_symbol} - {company_name}")
    payload = []
    now = datetime.now()

    # --- 1. YFINANCE (Sự kiện tài chính) ---
    try:
        tk = yf.Ticker(ticker_symbol)
        actions = tk.actions[tk.actions.index >= "2000-01-01"]
        for date, row in actions.iterrows():
            div = row.get('Dividends', 0)
            split = row.get('Stock Splits', 0)
            etype = "Dividend" if div > 0 else "Stock Split"
            val = div if div > 0 else split
            
            title = f"[{ticker_symbol}] {etype}"
            # Lấy URL của Yahoo làm source
            event_url = f"https://finance.yahoo.com/quote/{ticker_symbol}"
            h_key = generate_hash_key(ticker_symbol, date, event_url, title)
            
            payload.append((
                str(uuid.uuid4()), h_key, ticker_symbol, title,
                f"Sự kiện tài chính: {company_name} ({ticker_symbol}) thực hiện {etype} với giá trị {val}.",
                date, 'report', event_url, # event_url lưu vào cột source
                'System-Quant', 'en', now, 0
            ))
    except Exception as e: 
        print(f"  ⚠️ YFinance Error: {e}")

    # --- 2. GDELT + NEWSPAPER3K (Tin tức & Crawl Content) ---
    params = {
        "query": f'"{company_name}" stock', "mode": "ArtList", 
        "maxrecords": 20, "format": "json", "startdatetime": "20230101000000" 
    }
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}

    try:
        time.sleep(7) # Lách luật GDELT Rate Limit
        res = requests.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, headers=headers, timeout=20)
        
        if res.status_code == 200:
            articles = res.json().get('articles', [])
            print(f"  🔍 GDELT: Tìm thấy {len(articles)} URLs. Đang cào nội dung...")
            
            for art in articles:
                url = art.get('url', '')
                title = art.get('title', 'No Title')
                
                content, p_date = fetch_article_content(url)
                
                if not p_date:
                    try:
                        p_date = datetime.strptime(art['seendate'], '%Y%m%dT%H%M%SZ')
                    except:
                        p_date = now

                # Dùng trực tiếp URL làm tham số source để băm hash
                h_key = generate_hash_key(ticker_symbol, p_date, url, title)
                final_content = content if content and len(content) > 50 else f"Nội dung tóm tắt: {title}. Link: {url}"
                
                payload.append((
                    str(uuid.uuid4()), h_key, ticker_symbol, title[:450],
                    final_content, p_date, 'article', url, # url được lưu vào cột source
                    'GDELT', 'en', now, 0
                ))
                time.sleep(10)
        elif res.status_code == 429:
            print("  🚫 GDELT: Rate Limit (429). Bỏ qua mã này.")
    except Exception as e:
        print(f"  ⚠️ GDELT/Crawl Error: {e}")

    # --- 3. THỰC THI NẠP DB ---
    if payload:
        new_records = insert_to_temp(payload)
        print(f"  ✅ DB: Đã nạp thêm {new_records} records mới (Bỏ qua {len(payload) - new_records} records trùng).")
    else:
        print("  ⚠️ Không có dữ liệu để nạp.")

if __name__ == "__main__":
    print(f"--- KHỞI ĐỘNG CRAWLER (Chế độ: Deep Content + Hash Anti-Dupe) ---")
    companies = get_all_companies()
    
    for co in companies:
        backfill_data(co['symbol'], co['company_name'])
        time.sleep(3)