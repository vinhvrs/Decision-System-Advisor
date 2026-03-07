import pymysql
import time
from config.settings import Config as settings

class DatabaseFinalFixer:
    def __init__(self):
        self.config = settings.DB_CONFIG.copy()
        self.conn = None

    def connect(self):
        self.config['cursorclass'] = pymysql.cursors.DictCursor
        self.conn = pymysql.connect(**self.config)
        self.conn.autocommit(True)

    def standardize(self):
        self.connect()
        try:
            with self.conn.cursor() as cur:
                print("--- ⚡ DỌN DẸP TRIỆT ĐỂ FORMAT SLUG ---")
                
                cur.execute("SELECT id, period, prefix FROM instrument_periods")
                periods = cur.fetchall()
                
                for idx, p in enumerate(periods):
                    p_id, p_name, symbol = p['id'], p['period'], p['prefix']
                    
                    # 1. Tìm và Xóa các bản ghi có slug sai format nếu bản ghi chuẩn đã tồn tại
                    # Bản ghi chuẩn là: {symbol}-{p_name}-{DATE} 00:00:00
                    sql_clean_trash = """
                        DELETE d1 FROM instrument_data d1
                        INNER JOIN instrument_data d2 
                        ON DATE(d1.timestamps) = DATE(d2.timestamps)
                        AND d1.instrument_period_id = d2.instrument_period_id
                        WHERE d1.instrument_period_id = %s
                        AND d1.slug != CONCAT(%s, '-', %s, '-', DATE(d1.timestamps), ' 00:00:00')
                        AND d2.slug = CONCAT(%s, '-', %s, '-', DATE(d2.timestamps), ' 00:00:00');
                    """
                    cur.execute(sql_clean_trash, (p_id, symbol, p_name, symbol, p_name))
                    deleted = cur.rowcount

                    # 2. Với những dòng còn lại (chưa có bản ghi chuẩn), ép chúng về chuẩn
                    # Dùng UPDATE (không IGNORE) vì lúc này các dòng gây trùng đã bị xóa ở bước 1
                    sql_force_update = """
                        UPDATE instrument_data 
                        SET 
                            timestamps = CONCAT(DATE(timestamps), ' 00:00:00'),
                            slug = CONCAT(%s, '-', %s, '-', DATE(timestamps), ' 00:00:00')
                        WHERE instrument_period_id = %s
                        AND slug != CONCAT(%s, '-', %s, '-', DATE(timestamps), ' 00:00:00');
                    """
                    try:
                        cur.execute(sql_force_update, (symbol, p_name, p_id, symbol, p_name))
                        updated = cur.rowcount
                    except pymysql.err.IntegrityError:
                        # Nếu vẫn trùng (do dữ liệu rác quá nhiều), dùng chiêu cuối: xóa dòng đó luôn
                        cur.execute("""
                            DELETE FROM instrument_data 
                            WHERE instrument_period_id = %s 
                            AND slug != CONCAT(%s, '-', %s, '-', DATE(timestamps), ' 00:00:00')
                            LIMIT 100
                        """, (p_id, symbol, p_name))
                        updated = "Cleaned Dupes"

                    if deleted > 0 or (isinstance(updated, int) and updated > 0):
                        print(f"✅ [{idx+1}] {symbol}-{p_name}: Xóa rác: {deleted} | Ép chuẩn: {updated}")

                print("\n✨ TẤT CẢ SLUG ĐÃ ĐỒNG BỘ VỀ 1 FORMAT DUY NHẤT!")

        except Exception as e:
            print(f"❌ Lỗi: {e}")
        finally:
            if self.conn: self.conn.close()

if __name__ == "__main__":
    fixer = DatabaseFinalFixer()
    fixer.standardize()