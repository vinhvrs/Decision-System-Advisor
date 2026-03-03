import pymysql
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "127.0.0.1"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASS", "root"),
    database=os.getenv("DB_NAME", "dsa"),
    autocommit=True
)

def cleanup_2026():
    total_deleted = 0
    batch_size = 5000 # Mỗi lần xóa 5k dòng để tránh Timeout
    
    print("🧹 Bắt đầu dọn dẹp dữ liệu lỗi từ 2026...")
    
    with conn.cursor() as cur:
        while True:
            # Lệnh xóa từng đợt
            sql = "DELETE FROM instrument_data WHERE slug REGEXP '-2026-(01|02|03)-' LIMIT %s"
            affected = cur.execute(sql, (batch_size,))
            
            total_deleted += affected
            if affected == 0:
                break
                
            print(f"✅ Đã xóa {total_deleted} dòng...")
            
    print(f"✨ Hoàn tất! Tổng cộng đã dọn dẹp {total_deleted} bản ghi lỗi.")

if __name__ == "__main__":
    cleanup_2026()