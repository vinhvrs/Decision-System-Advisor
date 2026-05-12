import pymysql

from app.analyze.ranking.stock_compare import MarketSyncService
from app.data_collect.collectors.demo_data_sync import DSADemoSync
from app.warm_up.warm_up import run_dashboard_daily_warmup
from config.settings import settings

TARGET_SYMBOLS = ["TSLA", "AMZN", "IBM", "META"]


def db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def print_status(title: str):
    conn = db_connect()
    try:
        with conn.cursor() as cur:
            ph = ",".join(["%s"] * len(TARGET_SYMBOLS))
            cur.execute(
                "SELECT UPPER(TRIM(symbol)) AS symbol, price, volume, liquidity, change_pct, updated_at "
                "FROM instrument_snapshot WHERE UPPER(TRIM(symbol)) IN (" + ph + ") "
                "ORDER BY FIELD(UPPER(TRIM(symbol)),'TSLA','AMZN','IBM','META')",
                TARGET_SYMBOLS,
            )
            rows = cur.fetchall() or []
            print(f"{title} instrument_snapshot:")
            for r in rows:
                print(r)
    finally:
        conn.close()


def load_ids():
    conn = db_connect()
    try:
        with conn.cursor() as cur:
            ph = ",".join(["%s"] * len(TARGET_SYMBOLS))
            cur.execute(
                "SELECT id, UPPER(TRIM(symbol)) AS symbol FROM instruments WHERE UPPER(TRIM(symbol)) IN (" + ph + ")",
                TARGET_SYMBOLS,
            )
            return {r["symbol"]: r["id"] for r in (cur.fetchall() or [])}
    finally:
        conn.close()


def main():
    print_status("[before]")

    ids = load_ids()
    demo = DSADemoSync(backfill_days=3650)
    try:
        for sym in TARGET_SYMBOLS:
            inst_id = ids.get(sym)
            if not inst_id:
                print(f"[skip] missing instrument {sym}")
                continue
            demo.update_stock(inst_id, sym)
            print(f"[ok] backfilled {sym}")
    finally:
        demo.conn.close()

    MarketSyncService().sync()
    print("[ok] instrument_snapshot synced")

    redis_ok, validate_ok, row_count = run_dashboard_daily_warmup(
        limit=200,
        chart_bars=90,
        skip_validation=False,
    )
    print({"redis_ok": redis_ok, "validate_ok": validate_ok, "row_count": row_count})
    print_status("[after]")


if __name__ == "__main__":
    main()

