import pymysql
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import date, timedelta

# Load cấu hình
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "127.0.0.1"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASS", "root"),
    database=os.getenv("DB_NAME", "dsa"),
    autocommit=True
)

def get_date_list(start_date, end_date):
    """Tạo danh sách các ngày từ start đến end theo định dạng -YYYY-MM-DD-"""
    days = []
    curr = start_date
    while curr <= end_date:
        days.append(f"-{curr.strftime('%Y-%m-%d')}-")
        curr += timedelta(days=1)
    return days

def cleanup_by_day():
    total_deleted_all = 0
    batch_size = 5000 
    
    # Cấu hình khoảng thời gian muốn xóa (Ví dụ: từ tháng 1 đến tháng 3 năm 2026)
    start = date(2026, 1, 1)
    end = date(2026, 3, 31)
    dates_to_clean = get_date_list(start, end)

    print(f"🚀 Bắt đầu dọn dẹp dữ liệu từ {start} đến {end}...")

    try:
        with conn.cursor() as cur:
            for day_pattern in dates_to_clean:
                day_deleted = 0
                print(f"📅 Đang xử lý ngày: {day_pattern}")
                
                while True:
                    # Sử dụng LIKE thay cho REGEXP sẽ nhanh hơn nếu có index ở cột slug
                    sql = "DELETE FROM instrument_data WHERE slug LIKE %s LIMIT %s"
                    affected = cur.execute(sql, (f"%{day_pattern}%", batch_size))
                    
                    day_deleted += affected
                    total_deleted_all += affected
                    
                    if affected == 0:
                        break
                    
                    print(f"   Batch: Đã xóa {day_deleted} dòng của ngày này...")
                
                if day_deleted > 0:
                    print(f"✅ Hoàn tất ngày {day_pattern}: Xóa {day_deleted} dòng.")
                    
    except Exception as e:
        print(f"❌ Có lỗi xảy ra: {e}")
    finally:
        conn.close()
            
    print(f"---")
    print(f"✨ TỔNG KẾT: Đã dọn dẹp thành công {total_deleted_all} bản ghi.")

if __name__ == "__main__":
    cleanup_by_day()