import pymysql

from app.analyze.ranking.stock_compare import MarketSyncService
from app.data_collect.collectors.stock_sync import DSATurbo
from app.warm_up.warm_up import run_dashboard_daily_warmup
from config.settings import settings


FIXED_10 = ["NVDA", "TSLA", "AAPL", "GOOGL", "IBM", "MSFT", "AMZN", "META", "ORCL", "AVGO"]


def db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def load_instrument_ids(symbols: list[str]) -> dict[str, str]:
    conn = db_connect()
    try:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(symbols))
            sql = (
                "SELECT id, UPPER(TRIM(symbol)) AS symbol "
                f"FROM instruments WHERE UPPER(TRIM(symbol)) IN ({placeholders})"
            )
            cur.execute(sql, symbols)
            rows = cur.fetchall() or []
            return {str(r["symbol"]): str(r["id"]) for r in rows}
    finally:
        conn.close()


def main() -> None:
    id_by_symbol = load_instrument_ids(FIXED_10)
    print("Found symbols:", sorted(id_by_symbol.keys()))

    turbo = DSATurbo(backfill_days=3650)
    try:
        for sym in FIXED_10:
            inst_id = id_by_symbol.get(sym)
            if not inst_id:
                print(f"[skip] instrument not found: {sym}")
                continue
            turbo.update_stock(inst_id, sym)
            print(f"[ok] backfilled: {sym}")
    finally:
        turbo.conn.close()

    # Recompute instrument_snapshot + heatmap/ranking redis keys.
    MarketSyncService().sync()
    print("[ok] instrument_snapshot refreshed")

    # Rebuild dashboard:daily that the frontend board consumes.
    redis_ok, validate_ok, row_count = run_dashboard_daily_warmup(
        limit=200,
        chart_bars=90,
        skip_validation=False,
    )
    print({"redis_ok": redis_ok, "validate_ok": validate_ok, "row_count": row_count})


if __name__ == "__main__":
    main()

