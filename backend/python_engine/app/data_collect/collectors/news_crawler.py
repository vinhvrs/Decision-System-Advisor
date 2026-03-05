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

# --- Import Config từ hệ thống mới (Để lấy DB_CONFIG) ---
from config.settings import Config

# =========================
# Configuration Constants
# =========================
RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
SOURCE_NAME = "yahoo_rss"

UA = "Mozilla/5.0 (NewsCrawler/1.0; +https://example.local)"
TIMEOUT = 15
SLEEP_SEC = 0.25

MAX_SCAN_PER_SYMBOL = 120      # Quét tối đa entries trong RSS
TARGET_PER_SYMBOL = 10         # Lấy tối đa 10 bài mới mỗi mã
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
# DB & Helpers
# =========================
def db_conn():
    """Sử dụng Config.DB_CONFIG từ hệ thống mới"""
    return pymysql.connect(**Config.DB_CONFIG)

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
    try:
        if getattr(entry, "published_parsed", None):
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    except Exception:
        pass
    return None

def to_utc_aware(dt: datetime | None) -> datetime | None:
    if not dt: return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def http_get(url: str):
    return requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT, allow_redirects=True)

def resolve_final_url(url: str) -> str | None:
    if not url or is_blocked(url):
        return None
    try:
        r = requests.head(url, allow_redirects=True, headers={"User-Agent": UA}, timeout=TIMEOUT)
        if r.status_code >= 400 or not r.url:
            r = http_get(url)
        if r.status_code >= 400 or is_blocked(r.url):
            return None
        return r.url
    except Exception:
        return None

def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg", "aside"]):
        tag.decompose()

    root = soup.find("article") or soup.body or soup
    text = root.get_text("\n", strip=True)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)

def fetch_article_text(url: str, retries: int = 2) -> str | None:
    for _ in range(retries + 1):
        try:
            r = http_get(url)
            if r.status_code != 200: continue
            text = extract_text(r.text)
            if looks_bad(text): return None
            return text
        except Exception:
            continue
    return None

def detect_language(text: str) -> str:
    if not text: return "English"
    for ch in text[:500]:
        if "\u4e00" <= ch <= "\u9fff": return "Chinese"
    return "English"

# =========================
# State & Lock Management
# =========================
def acquire_lock(cur, symbol: str) -> bool:
    cur.execute("""
        INSERT IGNORE INTO crawler_states (id, source, symbol, created_at, updated_at)
        VALUES (%s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    """, (str(uuid.uuid4()), SOURCE_NAME, symbol))

    cur.execute("""
        UPDATE crawler_states
        SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s MINUTE),
            last_run_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
          AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP())
    """, (LOCK_MINUTES, SOURCE_NAME, symbol))
    return cur.rowcount == 1

def release_lock(cur, symbol: str):
    cur.execute("""
        UPDATE crawler_states SET locked_until = NULL, updated_at = UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (SOURCE_NAME, symbol))

def mark_success(cur, symbol: str, last_published_at: datetime | None, last_guid: str | None):
    cur.execute("""
        UPDATE crawler_states
        SET last_published_at=%s, last_guid=%s, fail_count=0, last_error=NULL,
            last_run_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (
        last_published_at.replace(tzinfo=None) if last_published_at else None,
        last_guid, SOURCE_NAME, symbol
    ))

def mark_failure(cur, symbol: str, err: str):
    cur.execute("""
        UPDATE crawler_states
        SET fail_count=fail_count+1, last_error=%s,
            last_run_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
    """, (str(err)[:2000], SOURCE_NAME, symbol))

# =========================
# Main Logic
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
            # 1. Lấy trạng thái cũ
            cur.execute("SELECT last_published_at, last_guid FROM crawler_states WHERE source=%s AND symbol=%s", (SOURCE_NAME, symbol))
            state = cur.fetchone() or {"last_published_at": None, "last_guid": None}
            last_published_at_utc = to_utc_aware(state.get("last_published_at"))

            # 2. Parse RSS
            feed = feedparser.parse(RSS_TMPL.format(symbol=symbol))
            entries = getattr(feed, "entries", []) or []

            newest_dt = None
            newest_guid = None

            for e in entries[:MAX_SCAN_PER_SYMBOL]:
                if stats["inserted"] >= TARGET_PER_SYMBOL: break

                stats["scanned"] += 1
                link = (e.get("link") or "").strip()
                pub_dt_utc = to_utc_aware(parse_rss_dt(e))

                # Skip bài cũ
                if last_published_at_utc and pub_dt_utc and pub_dt_utc <= last_published_at_utc:
                    continue

                final_url = resolve_final_url(link)
                if not final_url or final_url in existing_sources:
                    if final_url in existing_sources: stats["dup"] += 1
                    continue

                # 3. Fetch nội dung
                content = fetch_article_text(final_url)
                if not content: continue

                # --- XỬ LÝ AUTHOR ĐỂ TRÁNH "STOCKS" ---
                # Ưu tiên: Người viết -> Tên nguồn báo -> Tên miền -> Cuối cùng mới đến Symbol
                raw_author = (e.get("author") or 
                              e.get("source", {}).get("title") or 
                              e.get("publisher"))
                if not raw_author:
                    raw_author = norm_domain(final_url) or symbol
                
                author = raw_author.strip()
                title = (e.get("title") or "").strip()
                language = detect_language(content)

                # 4. Insert DOC (Format cũ)
                cur.execute("""
                    INSERT INTO knowledge_docs (id, title, content, category, source, author, language, created_at, updated_at)
                    VALUES (%s, %s, %s, 'article', %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, (str(uuid.uuid4()), title[:500], content, final_url[:500], author[:500], language))
                
                existing_sources.add(final_url)
                stats["inserted"] += 1

                if pub_dt_utc and (newest_dt is None or pub_dt_utc > newest_dt):
                    newest_dt = pub_dt_utc
                    newest_guid = (e.get("id") or e.get("guid") or link).strip()

                if stats["inserted"] % COMMIT_EVERY == 0:
                    conn.commit()
                time.sleep(SLEEP_SEC)

            conn.commit()
            mark_success(cur, symbol, newest_dt if newest_dt else state.get("last_published_at"), 
                         newest_guid if newest_guid else state.get("last_guid"))
            release_lock(cur, symbol)
            conn.commit()
            return stats

        except Exception as ex:
            conn.rollback()
            try:
                mark_failure(cur, symbol, str(ex))
                release_lock(cur, symbol)
                conn.commit()
            except: pass
            stats["fail"] = 1
            return stats

def main():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # Lấy symbols từ snapshot sử dụng Config.TOP_N
            cur.execute(f"""
                SELECT s.symbol FROM instrument_snapshot s
                JOIN (SELECT symbol, MAX(updated_at) as max_up FROM instrument_snapshot GROUP BY symbol) t
                ON s.symbol = t.symbol AND s.updated_at = t.max_up
                ORDER BY COALESCE(s.liquidity,0) DESC, COALESCE(s.volume,0) DESC LIMIT %s
            """, (Config.TOP_N,))
            symbols = [r["symbol"].upper() for r in cur.fetchall() if r.get("symbol")]

            cur.execute("SELECT source FROM knowledge_docs WHERE category='article' AND source IS NOT NULL")
            existing_sources = {r["source"] for r in cur.fetchall()}

        print(f"🚀 Crawler started for Top {len(symbols)} symbols.")
        all_stats = []
        for sym in symbols:
            st = crawl_symbol(conn, sym, existing_sources)
            all_stats.append(st)
            print(f"📍 {sym}: +{st['inserted']} articles, Scanned {st['scanned']}")

        print("✨ DONE:", json.dumps(all_stats, ensure_ascii=False))
    finally:
        conn.close()

if __name__ == "__main__":
    main()