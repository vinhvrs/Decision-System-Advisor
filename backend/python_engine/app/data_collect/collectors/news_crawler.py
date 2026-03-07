import os
import time
import uuid
import json
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import feedparser
import requests
import pymysql
from bs4 import BeautifulSoup

# --- Import Config từ hệ thống ---
from config.settings import Config

# Thiết lập Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =========================
# Configuration Constants
# =========================
RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
SOURCE_NAME = "yahoo_rss"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT = 15
SLEEP_SEC = 0.5

MAX_SCAN_PER_SYMBOL = 50 
TARGET_PER_SYMBOL = 10 
MIN_CONTENT_CHARS = 500

LOCK_MINUTES = 10
COMMIT_EVERY = 5

# =========================
# DB & Helpers
# =========================
def db_conn():
    # Cách này sẽ lấy config gốc, nếu trong đó chưa có cursorclass thì mới thêm vào
    conf = Config.DB_CONFIG.copy()
    conf.setdefault('cursorclass', pymysql.cursors.DictCursor)
    return pymysql.connect(**conf)

def norm_domain(url: str) -> str:
    try: return urlparse(url).netloc.lower()
    except: return ""

def get_company_mapping(conn):
    """Tạo từ điển Symbol và Tên công ty để Fallback scan"""
    mapping = {}
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, company_name FROM company_profile")
        rows = cur.fetchall()
        for r in rows:
            sym = r['symbol']
            name = r['company_name']
            short_name = name.split(' ')[0].replace(',', '') if name else ""
            mapping[sym] = short_name
    return mapping

def auto_detect_symbol(title, content, mapping, default_symbol=None):
    """Quét text để tìm symbol nếu RSS bị thiếu"""
    if default_symbol: return default_symbol
    
    combined_text = f"{title} {content}"
    for sym, short_name in mapping.items():
        # Tìm chính xác mã ticker (Case Sensitive để tránh nhầm từ thường)
        if re.search(rf'\b{sym}\b', combined_text):
            return sym
        # Tìm theo tên (Không phân biệt hoa thường)
        if short_name and len(short_name) > 3:
            if re.search(rf'\b{re.escape(short_name)}\b', combined_text, re.IGNORECASE):
                return sym
    return None

def extract_thumbnail(entry) -> str or None:
    try:
        if 'media_content' in entry: return entry['media_content'][0]['url']
        if 'links' in entry:
            for link in entry['links']:
                if 'image' in link.get('type', ''): return link.get('href')
    except: pass
    return None

def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "aside"]):
        tag.decompose()
    root = soup.find("article") or soup.find("div", class_="caas-body") or soup.body or soup
    text = root.get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.splitlines() if len(ln.strip()) > 20]
    return "\n".join(lines)

def to_utc_aware(dt):
    if not dt: return None
    if dt.tzinfo is None: return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

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

# =========================
# Main Logic
# =========================
def crawl_symbol(conn, symbol: str, existing_sources: set[str], company_mapping: dict) -> dict:
    symbol = symbol.upper().strip()
    stats = {"symbol": symbol, "inserted": 0, "scanned": 0, "dup": 0, "fail": 0}

    with conn.cursor() as cur:
        if not acquire_lock(cur, symbol): return stats
        conn.commit()

        try:
            cur.execute("SELECT last_published_at FROM crawler_states WHERE source=%s AND symbol=%s", (SOURCE_NAME, symbol))
            state = cur.fetchone()
            last_pub = to_utc_aware(state['last_published_at']) if state else None

            feed = feedparser.parse(RSS_TMPL.format(symbol=symbol))
            entries = feed.entries if hasattr(feed, "entries") else []
            newest_dt = last_pub

            # Regex xóa prefix news: ở đầu
            prefix_pattern = re.compile(r'^news\s*:\s*', re.IGNORECASE)

            for e in entries[:MAX_SCAN_PER_SYMBOL]:
                if stats["inserted"] >= TARGET_PER_SYMBOL: break
                
                stats["scanned"] += 1
                link = e.get("link", "").strip()
                pub_dt = None
                if hasattr(e, "published_parsed"):
                    pub_dt = to_utc_aware(datetime(*e.published_parsed[:6]))

                if last_pub and pub_dt and pub_dt <= last_pub: continue
                if link in existing_sources: continue

                # 3. Fetch nội dung
                try:
                    res = requests.get(link, headers={"User-Agent": UA}, timeout=TIMEOUT)
                    if res.status_code != 200: continue
                    content = extract_text(res.text)
                    if len(content) < MIN_CONTENT_CHARS: continue
                except: continue

                # Chuẩn hóa dữ liệu
                clean_title = prefix_pattern.sub('', e.get("title", "")).strip()
                detected_symbol = auto_detect_symbol(clean_title, content, company_mapping, default_symbol=symbol)
                image_url = extract_thumbnail(e)
                author = e.get("author") or e.get("source", {}).get("title") or "Yahoo Finance"

                # 4. INSERT
                cur.execute("""
                    INSERT INTO knowledge_docs 
                    (id, title, content, image, category, symbol, source, author, is_processed, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'article', %s, %s, %s, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, (str(uuid.uuid4()), clean_title[:500], content, image_url, detected_symbol, link[:500], author[:500]))
                
                stats["inserted"] += 1
                existing_sources.add(link)
                if pub_dt and (newest_dt is None or pub_dt > newest_dt): newest_dt = pub_dt

                if stats["inserted"] % COMMIT_EVERY == 0: conn.commit()
                time.sleep(SLEEP_SEC)

            # Release lock & Update state
            cur.execute("""
                UPDATE crawler_states SET 
                last_published_at=%s, last_run_at=UTC_TIMESTAMP(), locked_until=NULL, fail_count=0
                WHERE source=%s AND symbol=%s
            """, (newest_dt.replace(tzinfo=None) if newest_dt else None, SOURCE_NAME, symbol))
            conn.commit()

        except Exception as ex:
            conn.rollback()
            logger.error(f"Error {symbol}: {ex}")
            cur.execute("UPDATE crawler_states SET locked_until=NULL WHERE symbol=%s", (symbol,))
            conn.commit()
            stats["fail"] = 1
            
    return stats

def main():
    conn = db_conn()
    try:
        company_mapping = get_company_mapping(conn)
        with conn.cursor() as cur:
            cur.execute(f"SELECT symbol FROM company_profile ORDER BY market_cap DESC LIMIT {Config.TOP_N}")
            symbols = [r["symbol"].upper() for r in cur.fetchall()]
            cur.execute("SELECT source FROM knowledge_docs WHERE source IS NOT NULL")
            existing_sources = {r["source"] for r in cur.fetchall()}

        logger.info(f"🚀 Crawler Running for {len(symbols)} symbols")
        for sym in symbols:
            st = crawl_symbol(conn, sym, existing_sources, company_mapping)
            print(f"📍 {sym}: +{st['inserted']} docs")
    finally:
        conn.close()

if __name__ == "__main__":
    main()