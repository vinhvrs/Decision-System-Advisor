import pymysql
import time
from config.settings import Config as settings

class DatabaseOptimizer:
    def __init__(self):
        self.config = settings.DB_CONFIG.copy()
        self.config['connect_timeout'] = 3600
        self.conn = None

    def connect(self):
        self.conn = pymysql.connect(**self.config)
        self.conn.autocommit(True)

    def execute_query(self, query, message):
        with self.conn.cursor() as cur:
            try:
                print(f"{message}...")
                start = time.time()
                cur.execute(query)
                print(f"Done ({time.time() - start:.2f}s)")
            except Exception as e:
                err_msg = str(e)
                if any(x in err_msg for x in ["Duplicate key name", "Can't DROP", "exists"]):
                    print("Skipped (already applied).")
                else:
                    print(f"Error: {e}")

    def optimize(self):
        self.connect()
        try:
            with self.conn.cursor() as cur:
                print("Setting session timeouts for long index builds...")
                cur.execute("SET SESSION wait_timeout = 3600;")
                cur.execute("SET SESSION interactive_timeout = 3600;")
                cur.execute("SET SESSION innodb_lock_wait_timeout = 3600;")
                cur.execute("SET SESSION sort_buffer_size = 256 * 1024 * 1024;")

                print("\n--- Index maintenance ---")

                sql_data_index = """
                    ALTER TABLE instrument_data
                    ADD INDEX `idx_period_ts_vol` (instrument_period_id, timestamps, volume)
                """
                self.execute_query(
                    sql_data_index,
                    "Adding composite index on instrument_data (may take several minutes on large tables)",
                )

                self.execute_query(
                    "ALTER TABLE instrument_periods ADD INDEX `idx_period_name` (period)",
                    "Adding index on instrument_periods.period",
                )

                redundant_indexes = [
                    ("instruments", "instruments_symbol_index"),
                    ("instrument_periods", "instrument_periods_instrument_id_foreign"),
                ]
                for table, idx in redundant_indexes:
                    self.execute_query(
                        f"ALTER TABLE {table} DROP INDEX {idx}",
                        f"Dropping redundant index {idx} on {table}",
                    )

                print("\n--- Analyze tables ---")
                self.execute_query("ANALYZE TABLE instrument_data", "ANALYZE instrument_data")
                self.execute_query("ANALYZE TABLE instrument_periods", "ANALYZE instrument_periods")

                print("\nOptimizer finished.")

        finally:
            if self.conn:
                self.conn.close()

if __name__ == "__main__":
    optimizer = DatabaseOptimizer()
    optimizer.optimize()
