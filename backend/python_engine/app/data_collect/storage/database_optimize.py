import pymysql
import time
from config.settings import Config as settings # Đảm bảo đúng đường dẫn config của bạn

class DatabaseOptimizer:
    def __init__(self):
        self.config = settings.DB_CONFIG.copy()
        # Nâng timeout kết nối từ phía client (Python) lên 1 giờ (3600s)
        self.config['connect_timeout'] = 3600
        self.conn = None

    def connect(self):
        self.conn = pymysql.connect(**self.config)
        self.conn.autocommit(True)

    def execute_query(self, query, message):
        with self.conn.cursor() as cur:
            try:
                print(f"⏳ {message}...")
                start = time.time()
                cur.execute(query)
                print(f"✅ Xong! (Thời gian: {time.time() - start:.2f}s)")
            except Exception as e:
                err_msg = str(e)
                if any(x in err_msg for x in ["Duplicate key name", "Can't DROP", "exists"]):
                    print(f"⚠️ Bỏ qua: Thao tác đã được thực hiện trước đó.")
                else:
                    print(f"❌ Lỗi: {e}")

    def optimize(self):
        self.connect()
        try:
            with self.conn.cursor() as cur:
                # 1. NÂNG TỐI ĐA TIMEOUT TRÊN SESSION (Rất quan trọng cho 16M dòng)
                print("⚙️ Cấu hình tham số hệ thống chống Timeout...")
                cur.execute("SET SESSION wait_timeout = 3600;")
                cur.execute("SET SESSION interactive_timeout = 3600;")
                cur.execute("SET SESSION innodb_lock_wait_timeout = 3600;")
                # Tăng tốc độ tạo index bằng cách sử dụng nhiều bộ nhớ hơn cho sort
                cur.execute("SET SESSION sort_buffer_size = 256 * 1024 * 1024;") 

                print("\n--- 🔧 BẮT ĐẦU TỐI ƯU HÓA INDEX ---")

                # 2. Index chính phục vụ Liquidity & Heatmap (Dựa trên PHP Service của bạn)
                # Index này giúp lệnh MAX(timestamps) và WHERE period='daily' chạy cực nhanh
                sql_data_index = """
                    ALTER TABLE instrument_data 
                    ADD INDEX `idx_period_ts_vol` (instrument_period_id, timestamps, volume)
                """
                self.execute_query(sql_data_index, "Đang xây dựng Index hỗn hợp cho 16M dòng (Có thể mất 5-15 phút)")

                # 3. Index cho các cột hay dùng để JOIN hoặc tìm kiếm
                # Giúp LiquidityService.php chunk data nhanh hơn
                self.execute_query(
                    "ALTER TABLE instrument_periods ADD INDEX `idx_period_name` (period)",
                    "Tối ưu index cho cột 'period' trong bảng instrument_periods"
                )

                # 4. Xóa các Index dư thừa (Lưu ý: Chỉ xóa nếu bạn chắc chắn tên index)
                redundant_indexes = [
                    ("instruments", "instruments_symbol_index"),
                    ("instrument_periods", "instrument_periods_instrument_id_foreign")
                ]
                for table, idx in redundant_indexes:
                    self.execute_query(
                        f"ALTER TABLE {table} DROP INDEX {idx}",
                        f"Dọn dẹp index dư thừa '{idx}' trên bảng '{table}'"
                    )

                # 5. Bảo trì tổng thể
                print("\n--- 🧹 BẢO TRÌ HỆ THỐNG ---")
                # ANALYZE TABLE rất nhanh, giúp Optimizer chọn đúng Index
                self.execute_query("ANALYZE TABLE instrument_data", "Cập nhật thống kê (Analyze)")
                self.execute_query("ANALYZE TABLE instrument_periods", "Cập nhật thống kê (Periods)")
                
                print("\n✨ TẤT CẢ THAO TÁC HOÀN TẤT!")

        finally:
            if self.conn:
                self.conn.close()

if __name__ == "__main__":
    optimizer = DatabaseOptimizer()
    optimizer.optimize()