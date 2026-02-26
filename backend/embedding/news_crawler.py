import argparse
import json
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import feedparser
import pymysql
import requests
from bs4 import BeautifulSoup

RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
UA = "Mozilla/5.0 (NewsCrawler/1.0; +https://example.local)"

BLOCKED_DOMAINS = {
    "consent.yahoo.com",   # redirect cookie consent
}

BAD_CONTENT_MARKERS = [
    "Oops, something went wrong",
    "抱歉，發生錯誤",
    "Your privacy is important to us",
]

def now_utc():
    return datetime.now(timezone.utc)

def norm_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""

def is_blocked(url: str) -> bool:
    return norm_domain(url) in BLOCKED_DOMAINS

def looks_bad_content(text: str) -> bool:
    t = (text or "").lower()
    for m in BAD_CONTENT_MARKERS:
        if m.lower() in t:
            return True
    return False

def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()

    root = soup.find("article") or soup
    text = root.get_text("\n", strip=True)
    return text

def resolve_final_url(url: str, timeout=12) -> str | None:
    if not url:
        return None
    if is_blocked(url):
        return None
    try:
        # HEAD đôi khi bị chặn -> fallback GET
        r = requests.head(url, allow_redirects=True, headers={"User-Agent": UA}, timeout=timeout)
        if r.status_code >= 400 or not r.url:
            r = requests.get(url, allow_redirects=True, headers={"User-Agent": UA}, timeout=timeout)
        if r.status_code >= 400:
            return None
        if is_blocked(r.url):
            return None
        return r.url
    except Exception:
        return None

def fetch_article_text(url: str, timeout=12, retries=2) -> str | None:
    if not url or is_blocked(url):
        return None

    for _ in range(retries + 1):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
            if r.status_code != 200:
                continue
            text = extract_text(r.text)
            if looks_bad_content(text):
                return None
            # ngưỡng tối thiểu để tránh trang lỗi / trang menu
            if len(text) < 600:
                return None
            return text
        except Exception:
            continue
    return None

def get_state(cur):
    cur.execute("SELECT last_symbol FROM crawler_state WHERE id=1")
    row = cur.fetchone()
    return row[0] if row else None

def set_state(cur, last_symbol):
    cur.execute("UPDATE crawler_state SET last_symbol=%s WHERE id=1", (last_symbol,))

def load_symbol_batch(cur, last_symbol, batch_size):
    if last_symbol:
        cur.execute("""
            SELECT symbol
            FROM instruments
            WHERE symbol IS NOT NULL AND symbol <> '' AND symbol > %s
            ORDER BY symbol
            LIMIT %s
        """, (last_symbol, batch_size))
    else:
        cur.execute("""
            SELECT symbol
            FROM instruments
            WHERE symbol IS NOT NULL AND symbol <> ''
            ORDER BY symbol
            LIMIT %s
        """, (batch_size,))
    return [r[0] for r in cur.fetchall()]

def exists_url(cur, url):
    cur.execute("SELECT 1 FROM knowledge_docs WHERE source=%s LIMIT 1", (url,))
    return cur.fetchone() is not None

def insert_doc(cur, symbol, title, content, source, domain, published_at):
    cur.execute("""
        INSERT INTO knowledge_docs
        (id, symbol, title, content, source, domain, published_at, created_at, updated_at)
        VALUES
        (%s, %s, %s, %s, %s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    """, (
        str(uuid.uuid4()),
        symbol,
        title[:512] if title else "",
        content,
        source[:1024],
        domain[:255] if domain else None,
        published_at
    ))

def parse_rss_date(entry):
    # feedparser trả structured time: entry.published_parsed
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.replace(tzinfo=None)  # MySQL DATETIME naive
    except Exception:
        pass
    return None

def export_jsonl(fp, obj):
    fp.write(json.dumps(obj, ensure_ascii=False) + "\n")
    fp.flush()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-host", default="127.0.0.1")
    ap.add_argument("--db-user", default="root")
    ap.add_argument("--db-pass", required=True)
    ap.add_argument("--db-name", default="dsa")
    ap.add_argument("--batch-size", type=int, default=800)         # 500–1500 ok
    ap.add_argument("--articles-per-symbol", type=int, default=10) # đúng yêu cầu
    ap.add_argument("--sleep", type=float, default=0.15)           # rate limit
    ap.add_argument("--output", default=None)                      # output.txt JSONL
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    conn = pymysql.connect(
        host=args.db_host,
        user=args.db_user,
        password=args.db_pass,
        database=args.db_name,
        charset="utf8mb4",
        autocommit=False,
    )
    cur = conn.cursor()

    last_symbol = get_state(cur)
    symbols = load_symbol_batch(cur, last_symbol, args.batch_size)

    # hết batch => reset để chạy vòng lại
    if not symbols:
        set_state(cur, None)
        conn.commit()
        print("[STATE] Reached end. Reset last_symbol=NULL")
        cur.close(); conn.close()
        return

    out_fp = open(args.output, "a", encoding="utf-8") if args.output else None

    stats = {
        "symbols": len(symbols),
        "inserted": 0,
        "dup_url": 0,
        "blocked": 0,
        "fetch_fail": 0,
        "extract_fail": 0,
        "scanned_entries": 0,
    }

    for sym in symbols:
        rss_url = RSS_TMPL.format(symbol=sym)
        feed = feedparser.parse(rss_url)

        entries = getattr(feed, "entries", []) or []
        # Yahoo trả nhiều, mình lấy đủ N
        for e in entries[:args.articles_per_symbol]:
            stats["scanned_entries"] += 1

            title = e.get("title")
            link = e.get("link")
            published_at = parse_rss_date(e)

            if not link or is_blocked(link):
                stats["blocked"] += 1
                continue

            final_url = resolve_final_url(link)
            if not final_url:
                stats["fetch_fail"] += 1
                continue
            if is_blocked(final_url):
                stats["blocked"] += 1
                continue

            if exists_url(cur, final_url):
                stats["dup_url"] += 1
                continue

            content = fetch_article_text(final_url)
            if not content:
                stats["extract_fail"] += 1
                continue

            domain = norm_domain(final_url)

            record = {
                "symbol": sym,
                "title": title,
                "published_at": published_at.isoformat() if published_at else None,
                "url": final_url,
                "domain": domain,
                "content": content,
                "ts_utc": now_utc().isoformat(),
            }

            if out_fp:
                export_jsonl(out_fp, record)

            if not args.dry_run:
                try:
                    insert_doc(cur, sym, title, content, final_url, domain, published_at)
                    conn.commit()
                    stats["inserted"] += 1
                except pymysql.err.IntegrityError:
                    # unique source trùng -> ok
                    conn.rollback()
                    stats["dup_url"] += 1
                except Exception:
                    conn.rollback()
                    stats["fetch_fail"] += 1

            time.sleep(args.sleep)

        # update state theo symbol đã xử lý
        if not args.dry_run:
            set_state(cur, sym)
            conn.commit()

    if out_fp:
        out_fp.close()

    print("=== DONE ===")
    print(json.dumps(stats, indent=2, ensure_ascii=False))

    cur.close(); conn.close()

if __name__ == "__main__":
    main()