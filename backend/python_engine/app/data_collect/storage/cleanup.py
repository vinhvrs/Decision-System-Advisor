import pymysql
from config.settings import Config

def deep_clean_duplicates():
    print("🚀 Đang quét và dọn dẹp bản ghi trùng lặp dựa trên slug...")
    try:
        conn = pymysql.connect(**Config.DB_CONFIG)
        with conn.cursor() as cur:
            # Tìm danh sách các slug bị lặp
            cur.execute("""
                SELECT slug, MIN(id) as keep_id, COUNT(*) 
                FROM instrument_data 
                GROUP BY slug 
                HAVING COUNT(*) > 1
            """)
            duplicates = cur.fetchall()
            
            if not duplicates:
                print("✨ Không tìm thấy dữ liệu trùng lặp.")
                return

            print(f"🔍 Tìm thấy {len(duplicates)} slug bị trùng. Đang xử lý...")
            
            for row in duplicates:
                # Xóa các bản ghi có cùng slug nhưng không phải là keep_id
                cur.execute("""
                    DELETE FROM instrument_data 
                    WHERE slug = %s AND id != %s
                """, (row['slug'], row['keep_id']))
            
            conn.commit()
            print(f"✅ Đã dọn dẹp xong!")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    deep_clean_duplicates()