import logging
import re
from app.data_collect.collectors.news_crawler import db_conn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def normalize_data():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # 1. LẤY TỪ ĐIỂN CÔNG TY
            cur.execute("SELECT symbol, company_name FROM company_profile")
            companies = cur.fetchall()
            
            company_mapping = {}
            for c in companies:
                sym = c['symbol']
                name = c['company_name']
                # Lấy chữ đầu tiên của tên công ty
                short_name = name.split(' ')[0].replace(',', '') if name else ""
                company_mapping[sym] = short_name

            # 2. LẤY BÀI BÁO CẦN CHUẨN HÓA
            cur.execute("SELECT id, title, content FROM knowledge_docs WHERE symbol IS NULL")
            docs = cur.fetchall()
            
            if not docs:
                logger.info("Không có bài báo nào bị thiếu symbol để chuẩn hóa.")
                return

            logger.info(f"Bắt đầu chuẩn hóa {len(docs)} bài báo...")
            update_count = 0
            match_symbol_count = 0
            
            # --- ĐÃ FIX LỖI REGEX Ở ĐÂY ---
            # Dùng cờ re.IGNORECASE thay vì nhúng (?i) vào chuỗi
            prefix_pattern = re.compile(r'^news\s*:\s*', re.IGNORECASE)
            
            # 3. TIẾN HÀNH QUÉT
            for doc in docs:
                doc_id = doc['id']
                original_title = str(doc['title']) if doc['title'] else ""
                content = str(doc['content']) if doc['content'] else ""
                
                # Gọt chữ "news:" ở đầu title
                clean_title = prefix_pattern.sub('', original_title).strip()
                
                combined_text = clean_title + " \n " + content
                found_symbol = None
                
                for sym, short_name in company_mapping.items():
                    # Tìm đúng mã Symbol (Phân biệt hoa thường)
                    if re.search(rf'\b{sym}\b', combined_text):
                        found_symbol = sym
                        break
                    
                    # Tìm theo tên công ty rút gọn (Không phân biệt hoa thường)
                    if short_name and re.search(rf'\b{re.escape(short_name)}\b', combined_text, re.IGNORECASE):
                        found_symbol = sym
                        break
                
                # CẬP NHẬT
                cur.execute("""
                    UPDATE knowledge_docs 
                    SET title = %s, symbol = %s 
                    WHERE id = %s
                """, (clean_title, found_symbol, doc_id))
                
                if found_symbol:
                    match_symbol_count += 1
                update_count += 1
                
                # In log tiến độ mỗi 2000 bài để tránh bị sốt ruột
                if update_count % 2000 == 0:
                    logger.info(f"Đang xử lý... {update_count}/{len(docs)}")
            
            conn.commit()
            logger.info(f"✅ Đã dọn dẹp Title cho {update_count} bài báo.")
            logger.info(f"🎯 Đã nhận diện và gắn thành công Symbol cho {match_symbol_count}/{update_count} bài.")
            
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Lỗi trong quá trình chuẩn hóa: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    normalize_data()