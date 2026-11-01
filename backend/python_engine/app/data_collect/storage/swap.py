import logging
from app.data_collect.collectors.news_crawler import db_conn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            logger.info("Đang đọc dữ liệu từ bảng knowledge (bỏ qua các record có author)...")
            cur.execute("""
                SELECT id, topic, content, url_slug, created_at, updated_at 
                FROM knowledge
                WHERE author IS NULL OR TRIM(author) = ''
            """)
            old_articles = cur.fetchall()
            
            if not old_articles:
                logger.info("Không có dữ liệu nào phù hợp để chuyển.")
                return

            logger.info(f"Tìm thấy {len(old_articles)} bài báo. Bắt đầu chuyển sang knowledge_docs...")
            
            success_count = 0
            
            insert_query = """
                INSERT IGNORE INTO knowledge_docs 
                (id, title, content, image, category, source, language, created_at, updated_at, is_processed)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            for row in old_articles:
                title = str(row['topic'])[:500] if row['topic'] else "Untitled"
                source = str(row['url_slug'])[:500] if row['url_slug'] else f"migrated_{row['id']}"
                
                # --- LOGIC BÓC TÁCH IMAGE URL ---
                raw_content = str(row['content']) if row['content'] else ""
                image_url = None
                clean_content = raw_content
                
                # Kiểm tra xem nội dung có bắt đầu bằng "Image URL:" không
                if raw_content.strip().startswith("Image URL:"):
                    # Cắt chuỗi ra làm 2 phần tại vị trí dấu xuống dòng đầu tiên
                    parts = raw_content.split('\n', 1)
                    
                    # Phần 1: Lấy URL và làm sạch khoảng trắng/xuống dòng thừa (Cắt tối đa 1000 ký tự theo CSDL)
                    image_url = parts[0].replace("Image URL:", "").strip()[:1000]
                    
                    # Phần 2: Phần còn lại là nội dung thật của bài báo
                    clean_content = parts[1].strip() if len(parts) > 1 else ""
                # --------------------------------
                
                cur.execute(insert_query, (
                    row['id'],          
                    title,              
                    clean_content,      # Nội dung đã được lọc bỏ dòng Image URL
                    image_url,          # Link ảnh đã bóc tách
                    'article',          
                    source,             
                    'en',               
                    row['created_at'],
                    row['updated_at'],
                    0                   
                ))
                
                if cur.rowcount > 0:
                    success_count += 1
            
            conn.commit()
            logger.info(f"✅ Hoàn tất! Đã chuyển thành công {success_count}/{len(old_articles)} bài báo.")
            
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Có lỗi xảy ra trong quá trình chuyển: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()