import pymysql
from config import Config

try:
    conn = pymysql.connect(**Config.DB_CONFIG)
    print("✅ Kết nối Database thành công!")
    conn.close()
except Exception as e:
    print(f"❌ Lỗi kết nối: {e}")