import os
import time
import hashlib
from datetime import datetime, timezone

import yfinance as yf
import pymysql
from dotenv import load_dotenv

import trafilatura

load_dotenv()

def db_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", ""),
        database=os.getenv("DB_NAME", "dsa"),
        charset="utf8mb4",
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
    )

def source_exists(cur, url: str) -> bool:
    cur.execute("SELECT 1 FROM knowledge_docs WHERE source = %s LIMIT 1", (url,))
    return cur.fetchone() is not None


def gen_uuid_like(url: str) -> str:
    # Deterministic UUID-like from URL hash (simple + stable). You can swap to uuid4 if you prefer.
    h = hashlib.md5(url.encode("utf-8")).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def extract_full_text(url: str) -> str | None:
    """
    Download + extract readable article text.
    Returns cleaned text or None.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        if not text:
            return None
        # Basic cleanup
        text = text.strip()
        if len(text) < 200:  # too short -> likely paywall/blocked
            return None
        return text
    except Exception:
        return None


def yahoo_time_to_dt(ts: int | None) -> datetime:
    if not ts:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def ingest_symbol(cur, symbol: str, limit: int = 30, sleep_sec: float = 0.7) -> int:
    """
    Fetch Yahoo Finance news for one ticker, extract full text, insert into DB.
    Returns inserted count.
    """
    t = yf.Ticker(symbol)

    # yfinance returns list[dict] with keys like:
    # title, link, publisher, providerPublishTime, type, relatedTickers...
    try:
        items = t.news or []
    except Exception:
        items = []

    inserted = 0
    for item in items[:limit]:
        url = item.get("link")
        title = item.get("title")
        publisher = item.get("publisher") or "Unknown"
        published_at = yahoo_time_to_dt(item.get("providerPublishTime"))

        if not url or not title:
            continue

        if source_exists(cur, url):
            continue

        full_text = extract_full_text(url)
        if not full_text:
            # fallback to title if you still want to store something
            # but for DSA vector pipeline, better skip low-quality docs
            continue

        doc_id = gen_uuid_like(url)
        now_dt = datetime.now(timezone.utc)

        cur.execute(
            """
            INSERT INTO knowledge_docs
                (id, title, content, category, source, author, language, created_at, updated_at)
            VALUES
                (%s, %s, %s, 'article', %s, %s, 'en', %s, %s)
            """,
            (
                doc_id,
                title,
                full_text,
                url,
                publisher,
                published_at.replace(tzinfo=None),
                now_dt.replace(tzinfo=None),
            ),
        )
        inserted += 1
        time.sleep(sleep_sec)

    return inserted


def main():
    symbols = [
        "AAPL", "NVDA", "MSFT", "AMZN", "GOOGL",
        # add your top market_cap list from DB later
    ]

    conn = db_conn()
    with conn.cursor() as cur:
        # optional: remove if table already exists
        # ensure_table(cur)

        total = 0
        for sym in symbols:
            print(f"[Yahoo] ingest {sym} ...")
            n = ingest_symbol(cur, sym, limit=30)
            total += n
            print(f"  inserted={n}")

    conn.close()
    print(f"Done. total_inserted={total}")


if __name__ == "__main__":
    main()