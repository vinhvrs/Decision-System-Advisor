import pymysql
from config import settings

class Tests:
    try:
        conn = pymysql.connect(**settings.DB_CONFIG)
        print("✅ Kết nối Database thành công!")
        conn.close()
    except Exception as e:
        print(f"❌ Lỗi kết nối: {e}")