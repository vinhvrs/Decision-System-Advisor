import pymysql
import time
from datetime import datetime
# Import cấu hình từ settings của bạn
try:
    from app.data_collect.storage.config import settings
except ImportError:
    from config.settings import settings

class UUIDSwapper:
    def __init__(self):
        self.config = settings.DB_CONFIG
        self.batch_size = 10000  # Giữ batch size nhỏ để tránh Lock Timeout
        self.conn = None

    def connect(self):
        # Mở kết nối với server
        self.conn = pymysql.connect(**self.config)
        self.conn.autocommit(True)

    def run(self):
        start_all = time.time()
        self.connect()
        
        try:
            with self.conn.cursor() as cur:
                print("🚀 [1/4] Khởi tạo Shadow Table...")
                cur.execute("DROP TABLE IF EXISTS instrument_data_temp")
                cur.execute("CREATE TABLE instrument_data_temp LIKE instrument_data")
                
                print("⚡ [2/4] Cấu hình Unique Index & Standard Timestamps...")
                # Tạo Unique Index để INSERT IGNORE tự động lọc trùng
                cur.execute("ALTER TABLE instrument_data_temp ADD UNIQUE INDEX `slug_UNIQUE` (`slug` ASC)")
                cur.execute("""
                    ALTER TABLE instrument_data_temp 
                    MODIFY created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    MODIFY updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                """)

                # Tính tổng số dòng để hiển thị tiến độ
                cur.execute("SELECT COUNT(*) as total FROM instrument_data")
                total_rows = cur.fetchone()['total']
                print(f"📊 Dữ liệu: {total_rows:,} dòng (Sử dụng UUID làm Primary Key)")

                print(f"🚚 [3/4] Đang di chuyển dữ liệu sạch bằng Cursor Pagination...")
                
                last_id = "" # Con trỏ lưu ID cuối cùng của batch trước
                total_migrated = 0
                processed_count = 0
                
                while True:
                    # Lấy batch tiếp theo dựa trên ID cuối cùng (Tránh dùng OFFSET cực chậm)
                    if last_id == "":
                        sql_select = f"SELECT * FROM instrument_data ORDER BY id ASC LIMIT {self.batch_size}"
                        cur.execute(sql_select)
                    else:
                        sql_select = f"SELECT * FROM instrument_data WHERE id > %s ORDER BY id ASC LIMIT {self.batch_size}"
                        cur.execute(sql_select, (last_id,))
                    
                    rows = cur.fetchall()
                    if not rows:
                        break # Hết dữ liệu
                    
                    # Chuẩn bị dữ liệu để nạp vào bảng mới
                    batch_data = []
                    for row in rows:
                        # Ép timestamp về YYYY-MM-DD 00:00:00
                        ts = row['timestamps']
                        if isinstance(ts, datetime):
                            ts_str = ts.strftime('%Y-%m-%d 00:00:00')
                        else:
                            # Nếu là string thì cắt lấy phần ngày
                            ts_str = f"{str(ts)[:10]} 00:00:00"

                        batch_data.append((
                            row['id'], row['instrument_period_id'], ts_str,
                            row['open'], row['high'], row['low'], row['close'],
                            row['volume'], row['source'], row['slug'],
                            row['created_at'] if row['created_at'] else datetime.now()
                        ))
                        last_id = row['id'] # Cập nhật ID cuối cùng

                    # Nạp vào bảng shadow (Sử dụng INSERT IGNORE để tự lọc trùng slug)
                    sql_insert = """
                        INSERT IGNORE INTO instrument_data_temp 
                        (id, instrument_period_id, timestamps, open, high, low, close, volume, source, slug, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """
                    cur.executemany(sql_insert, batch_data)
                    
                    processed_count += len(rows)
                    total_migrated += cur.rowcount # Số dòng thực tế được chèn (không tính dòng bị bỏ qua do trùng)
                    
                    # Log tiến độ mỗi 100k dòng
                    if processed_count % (self.batch_size * 10) == 0:
                        percent = (processed_count / total_rows) * 100
                        print(f"   📉 Tiến độ: {percent:.2f}% | Đã quét: {processed_count:,} | Đã nạp sạch: {total_migrated:,}")
                    
                    # Nghỉ cực ngắn để tránh Lock Timeout cho các tiến trình khác
                    time.sleep(0.02)

                print("🔄 [4/4] Hoán đổi bảng (Atomic Rename)...")
                backup_name = f"instrument_data_old_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                cur.execute(f"RENAME TABLE instrument_data TO {backup_name}, instrument_data_temp TO instrument_data")
                
                print(f"✨ HOÀN TẤT! 15.8M dòng đã được làm sạch.")
                print(f"📝 Backup tại: {backup_name}")

        except Exception as e:
            print(f"❌ Lỗi: {e}")
        finally:
            if self.conn:
                self.conn.close()
            print(f"⏱️ Tổng thời gian: {(time.time() - start_all)/60:.2f} phút.")

if __name__ == "__main__":
    swapper = UUIDSwapper()
    swapper.run()