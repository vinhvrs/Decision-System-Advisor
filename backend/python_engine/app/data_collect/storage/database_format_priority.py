import pymysql
import time
from config.settings import Config as settings

class DatabasePriorityFixer:
    def __init__(self):
        self.config = settings.DB_CONFIG.copy()
        self.conn = None

    def connect(self):
        self.config['cursorclass'] = pymysql.cursors.DictCursor
        self.conn = pymysql.connect(**self.config, connect_timeout=600)
        self.conn.autocommit(True)

    def standardize(self):
        self.connect()
        try:
            with self.conn.cursor() as cur:
                print("--- 🎯 CHUẨN HÓA ƯU TIÊN TOP 20 SYMBOLS (FIXED SYNTAX) ---")
                
                cur.execute("SET SESSION innodb_lock_wait_timeout = 15;")
                cur.execute("SET SESSION transaction_isolation = 'READ-COMMITTED';")

                # Lấy danh sách Periods của Top 20 symbols
                sql_get_priority = """
                    SELECT p.id as p_id, p.period, p.prefix 
                    FROM instrument_snapshot s
                    JOIN instruments i ON s.instrument_id = i.id
                    JOIN instrument_periods p ON i.id = p.instrument_id
                    ORDER BY s.volume DESC
                    LIMIT 100;
                """
                cur.execute(sql_get_priority)
                priority_periods = cur.fetchall()
                
                if not priority_periods:
                    print("⚠️ Không thấy snapshot, lấy 100 mã ngẫu nhiên...")
                    cur.execute("SELECT id as p_id, period, prefix FROM instrument_periods LIMIT 100")
                    priority_periods = cur.fetchall()

                for idx, p in enumerate(priority_periods):
                    p_id, p_name, symbol = p['p_id'], p['period'], p['prefix']
                    start_p = time.time()
                    
                    # 1. XÓA RÁC: Xóa các dòng sai format khi đã có dòng đúng format
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
                    deleted_trash = cur.rowcount

                    # 2. ÉP CHUẨN: Update timestamps và slug về 00:00:00
                    sql_force_update = """
                        UPDATE IGNORE instrument_data 
                        SET 
                            timestamps = CONCAT(DATE(timestamps), ' 00:00:00'),
                            slug = CONCAT(%s, '-', %s, '-', DATE(timestamps), ' 00:00:00'),
                            updated_at = NOW()
                        WHERE instrument_period_id = %s
                        AND slug != CONCAT(%s, '-', %s, '-', DATE(timestamps), ' 00:00:00');
                    """
                    cur.execute(sql_force_update, (symbol, p_name, p_id, symbol, p_name))
                    updated_count = cur.rowcount

                    # 3. DỌN TRÙNG CUỐI CÙNG (Sửa lỗi 1064 bằng cách dùng list ID)
                    total_final_clean = 0
                    while True:
                        # Tìm 200 ID trùng để xóa mỗi đợt
                        sql_find_dupes = """
                            SELECT d1.id FROM instrument_data d1
                            INNER JOIN instrument_data d2 
                            ON d1.timestamps = d2.timestamps 
                            AND d1.instrument_period_id = d2.instrument_period_id
                            AND d1.id <> d2.id
                            WHERE d1.instrument_period_id = %s
                            AND (d1.updated_at < d2.updated_at OR (d1.updated_at = d2.updated_at AND d1.id < d2.id))
                            LIMIT 200;
                        """
                        cur.execute(sql_find_dupes, (p_id,))
                        rows = cur.fetchall()
                        if not rows: break
                        
                        # Xây dựng list ID để DELETE đơn bảng (hỗ trợ LIMIT nếu cần, nhưng xóa theo ID là nhanh nhất)
                        ids_to_delete = ",".join([f"'{r['id']}'" for r in rows])
                        cur.execute(f"DELETE FROM instrument_data WHERE id IN ({ids_to_delete})")
                        total_final_clean += cur.rowcount

                    elapsed = time.time() - start_p
                    if deleted_trash > 0 or updated_count > 0 or total_final_clean > 0:
                        print(f"✅ [{idx+1}] {symbol.upper()} ({p_name}): Rác {deleted_trash} | Ép {updated_count} | Trùng {total_final_clean} ({elapsed:.2f}s)")

                print("\n✨ XỬ LÝ XONG TOP SYMBOLS!")

        except Exception as e:
            print(f"❌ Lỗi xử lý: {e}")
        finally:
            if self.conn: self.conn.close()

if __name__ == "__main__":
    fixer = DatabasePriorityFixer()
    fixer.standardize()