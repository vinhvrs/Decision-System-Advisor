import os
import time
import uuid
import json
from datetime import datetime, timezone
from urllib.parse import urlparse

import feedparser
import requests
import pymysql
from bs4 import BeautifulSoup

# =========================
# Config
# =========================
RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
SOURCE_NAME = "yahoo_rss"

UA = "Mozilla/5.0 (NewsCrawler/1.0; +https://example.local)"
TIMEOUT = 15
SLEEP_SEC = 0.25

MAX_SCAN_PER_SYMBOL = 120      # scan RSS entries to find enough new articles
TARGET_PER_SYMBOL = 10         # demo: 10 articles per symbol
MIN_CONTENT_CHARS = 600

LOCK_MINUTES = 10
COMMIT_EVERY = 10

BLOCKED_DOMAINS = {"consent.yahoo.com"}
BAD_MARKERS = [
    "Oops, something went wrong",
    "Your privacy is important to us",
    "Manage privacy settings",
    "Privacy dashboard",
    "抱歉，發生錯誤",
]

# =========================
# DB
# =========================
def db_conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "root"),
        database=os.getenv("DB_NAME", "dsa"),
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )

# =========================
# Helpers
# =========================
def norm_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""

def is_blocked(url: str) -> bool:
    return norm_domain(url) in BLOCKED_DOMAINS

def looks_bad(text: str) -> bool:
    if not text or len(text) < MIN_CONTENT_CHARS:
        return True
    low = text.lower()
    return any(m.lower() in low for m in BAD_MARKERS)

def parse_rss_dt(entry) -> datetime | None:
    """
    Parse published time from RSS entry.
    Returns timezone-aware UTC datetime or None.
    """
    try:
        if getattr(entry, "published_parsed", None):
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt
    except Exception:
        pass
    return None

def http_get(url: str):
    return requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, allow_redirects=True)

def resolve_final_url(url: str) -> str | None:
    """
    Resolve redirects to get final URL.
    """
    if not url or is_blocked(url):
        return None
    try:
        r = requests.head(url, allow_redirects=True, headers={"User-Agent": UA}, timeout=TIMEOUT)
        if r.status_code >= 400 or not r.url:
            r = http_get(url)
        if r.status_code >= 400:
            return None
        if is_blocked(r.url):
            return None
        return r.url
    except Exception:
        return None

def extract_text(html: str) -> str:
    """
    Minimal extraction. (good enough for news pages)
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "aside"]):
        tag.decompose()

    root = soup.find("article") or soup.body or soup
    text = root.get_text("\n", strip=True)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)

def fetch_article_text(url: str, retries: int = 2) -> str | None:
    if not url or is_blocked(url):
        return None
    for _ in range(retries + 1):
        try:
            r = http_get(url)
            if r.status_code != 200:
                continue
            text = extract_text(r.text)
            if looks_bad(text):
                return None
            return text
        except Exception:
            continue
    return None

def detect_language(text: str) -> str:
    """
    Store FULL WORD language name:
      - "Chinese" if contains CJK chars
      - else "English"
    """
    if not text:
        return "English"
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            return "Chinese"
    return "English"

def to_utc_aware(dt: datetime | None) -> datetime | None:
    """
    Normalize DB naive datetime to timezone-aware UTC.
    """
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

# =========================
# chunking (for knowledge_chunks later)
# =========================
def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Split long content into overlapping chunks.
    Later you'll insert these into knowledge_chunks with chunk_index, token, vector, qdrant_point_id...
    """
    if not text:
        return []

    chunks = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        start += max(1, chunk_size - overlap)

    return chunks

# =========================
# crawler_states (lock + resume)
# =========================
def acquire_lock(cur, symbol: str) -> bool:
    """
    Create state row if missing then lock via locked_until.
    Unique(source, symbol) is assumed.
    """
    cur.execute("""
        INSERT IGNORE INTO crawler_states (id, source, symbol, created_at, updated_at)
        VALUES (%s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    """, (str(uuid.uuid4()), SOURCE_NAME, symbol))

    cur.execute("""
        UPDATE crawler_states
        SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s MINUTE),
            last_run_at = UTC_TIMESTAMP(),
            updated_at = UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
          AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP())
    """, (LOCK_MINUTES, SOURCE_NAME, symbol))

    return cur.rowcount == 1

def release_lock(cur, symbol: str):
    cur.execute("""
        UPDATE crawler_states
        SET locked_until = NULL, updated_at = UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (SOURCE_NAME, symbol))

def get_state(cur, symbol: str):
    cur.execute("""
        SELECT last_published_at, last_guid
        FROM crawler_states
        WHERE source=%s AND symbol=%s
        LIMIT 1
    """, (SOURCE_NAME, symbol))
    return cur.fetchone() or {"last_published_at": None, "last_guid": None}

def mark_success(cur, symbol: str, last_published_at: datetime | None, last_guid: str | None):
    cur.execute("""
        UPDATE crawler_states
        SET last_published_at=%s,
            last_guid=%s,
            fail_count=0,
            last_error=NULL,
            last_run_at=UTC_TIMESTAMP(),
            updated_at=UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (
        last_published_at.replace(tzinfo=None) if last_published_at else None,
        last_guid,
        SOURCE_NAME,
        symbol
    ))

def mark_failure(cur, symbol: str, err: str):
    cur.execute("""
        UPDATE crawler_states
        SET fail_count=fail_count+1,
            last_error=%s,
            last_run_at=UTC_TIMESTAMP(),
            updated_at=UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (err[:2000], SOURCE_NAME, symbol))

# =========================
# instrument_snapshot -> symbols (most active)
# =========================
def load_top_symbols_from_snapshot(cur, limit: int = 20) -> list[str]:
    """
    Load top 'most active' symbols from instrument_snapshot.

    Strategy:
    - Use latest snapshot records (updated_at DESC)
    - Prefer highest liquidity, then volume
    - Return symbol list preserving ranking order (NOT alphabetical)

    Notes:
    - instrument_snapshot has: symbol, volume, liquidity, updated_at
    - If you maintain multiple snapshots per symbol over time, this query picks the latest row per symbol.
      (We do it by joining to max(updated_at) per symbol)
    """

    cur.execute(f"""
        SELECT s.symbol
        FROM instrument_snapshot s
        JOIN (
            SELECT symbol, MAX(updated_at) AS max_updated
            FROM instrument_snapshot
            WHERE symbol IS NOT NULL AND symbol <> ''
            GROUP BY symbol
        ) t
          ON s.symbol = t.symbol AND s.updated_at = t.max_updated
        ORDER BY
            COALESCE(s.liquidity, 0) DESC,
            COALESCE(s.volume, 0) DESC,
            s.symbol ASC
        LIMIT %s
    """, (limit,))

    rows = cur.fetchall() or []
    return [r["symbol"].upper() for r in rows if r.get("symbol")]

# =========================
# knowledge_docs
# =========================
def load_existing_sources(cur) -> set[str]:
    """
    Dedup by URL (source).
    knowledge_docs has no symbol column, so dedup is global.
    """
    cur.execute("""
        SELECT source
        FROM knowledge_docs
        WHERE category='article' AND source IS NOT NULL
    """)
    rows = cur.fetchall() or []
    return {r["source"] for r in rows if r.get("source")}

def insert_doc(cur, title: str, content: str, source_url: str, author: str):
    """
    Insert into knowledge_docs schema.
    language must be FULL WORD: "English" / "Chinese".
    """
    language = detect_language(content)

    cur.execute("""
        INSERT INTO knowledge_docs
            (id, title, content, category, source, author, language, created_at, updated_at)
        VALUES
            (%s, %s, %s, 'article', %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    """, (
        str(uuid.uuid4()),
        (title or "")[:500],
        content,
        (source_url or "")[:500],
        (author or "")[:500],
        language
    ))

# =========================
# Main crawl per symbol
# =========================
def crawl_symbol(conn, symbol: str, existing_sources: set[str]) -> dict:
    symbol = symbol.upper().strip()
    stats = {"symbol": symbol, "inserted": 0, "scanned": 0, "dup": 0, "fail": 0}

    with conn.cursor() as cur:
        if not acquire_lock(cur, symbol):
            stats["fail"] = 1
            return stats
        conn.commit()

        try:
            state = get_state(cur, symbol)
            last_published_at_db = state.get("last_published_at")
            last_published_at_utc = to_utc_aware(last_published_at_db)

            feed = feedparser.parse(RSS_TMPL.format(symbol=symbol))
            entries = getattr(feed, "entries", []) or []

            newest_dt = None
            newest_guid = None

            for e in entries[:MAX_SCAN_PER_SYMBOL]:
                if stats["inserted"] >= TARGET_PER_SYMBOL:
                    break

                stats["scanned"] += 1

                title = (e.get("title") or "").strip()
                link = (e.get("link") or "").strip()
                guid = (e.get("id") or e.get("guid") or link or "").strip()

                pub_dt = parse_rss_dt(e)
                pub_dt_utc = to_utc_aware(pub_dt)

                # incremental: skip older/equal checkpoint
                if last_published_at_utc and pub_dt_utc and pub_dt_utc <= last_published_at_utc:
                    continue

                if not link or is_blocked(link):
                    continue

                final_url = resolve_final_url(link)
                if not final_url or is_blocked(final_url):
                    continue

                if final_url in existing_sources:
                    stats["dup"] += 1
                    continue

                content = fetch_article_text(final_url)
                if not content:
                    continue

                author = (e.get("author") or e.get("publisher") or norm_domain(final_url) or "Unknown").strip()

                insert_doc(cur, title, content, final_url, author)
                existing_sources.add(final_url)
                stats["inserted"] += 1

                if pub_dt_utc and (newest_dt is None or pub_dt_utc > newest_dt):
                    newest_dt = pub_dt_utc
                    newest_guid = guid

                if stats["inserted"] % COMMIT_EVERY == 0:
                    conn.commit()

                time.sleep(SLEEP_SEC)

            conn.commit()

            if newest_dt or newest_guid:
                mark_success(cur, symbol, newest_dt, newest_guid)
            else:
                mark_success(cur, symbol, last_published_at_db, state.get("last_guid"))

            release_lock(cur, symbol)
            conn.commit()
            return stats

        except Exception as ex:
            conn.rollback()
            try:
                mark_failure(cur, symbol, str(ex))
                release_lock(cur, symbol)
                conn.commit()
            except Exception:
                pass
            stats["fail"] = 1
            return stats

def main():
    conn = db_conn()
    all_stats = []

    # 1) Load top 20 "most active" symbols from instrument_snapshot
    with conn.cursor() as cur:
        symbols = load_top_symbols_from_snapshot(cur, limit=20)
        print("Most Active Symbols:", symbols)

    # 2) Load existing URLs once for dedup
    with conn.cursor() as cur:
        existing_sources = load_existing_sources(cur)

    # 3) Crawl per symbol
    for sym in symbols:
        st = crawl_symbol(conn, sym, existing_sources)
        all_stats.append(st)
        print(json.dumps(st, ensure_ascii=False))

    conn.close()
    print("DONE:", json.dumps(all_stats, ensure_ascii=False))

if __name__ == "__main__":
    main()