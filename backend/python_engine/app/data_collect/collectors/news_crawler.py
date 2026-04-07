"""
Yahoo Finance RSS → ``knowledge_docs`` crawl only.

GDELT / scheduled ingest lives in ``news_handle``.
"""
import hashlib
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import feedparser
import pymysql
from newspaper import Article

from config.settings import Config
from app.data_collect.symbol_ingest import fetch_companies_for_ingest, resolve_ingest_scope

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
SOURCE_NAME = "yahoo_rss"

SLEEP_SEC = 0.5

MAX_SCAN_PER_SYMBOL = 50
TARGET_PER_SYMBOL = 10

LOCK_MINUTES = 10
COMMIT_EVERY = 5

# Demo / thesis: fixed watchlist (override with env NEWS_RSS_SYMBOLS=NVDA,TSLA,...)
FIXED_RSS_NEWS_SYMBOLS: Tuple[str, ...] = (
    "NVDA",
    "TSLA",
    "AMD",
    "MSFT",
    "AMZN",
    "META",
    "TQQQ",
    "TLT",
    "OXY",
    "BMNU",
    "MSTU",
    "DVLT",
    "SOFI",
    "SMCI",
    "CDE",
    "SOUN",
    "HBI",
    "UMAV",
    "AMC",
    "NMHI",
)


def rss_hash_key(symbol: str, link: str, title: str) -> str:
    raw = f"{symbol}|{link}|{(title or '')[:120]}".lower()
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def list_rss_symbols(conn) -> List[str]:
    """
    Symbols to crawl from Yahoo RSS.

    - ``NEWS_RSS_SYMBOLS`` — comma-separated list (highest priority).
    - Else ``NEWS_RSS_SYMBOL_MODE=ingest`` — use ``fetch_companies_for_ingest`` (same as old behavior).
    - Default ``fixed`` — :data:`FIXED_RSS_NEWS_SYMBOLS`.
    """
    env_list = os.environ.get("NEWS_RSS_SYMBOLS", "").strip()
    if env_list:
        return [s.strip().upper() for s in env_list.split(",") if s.strip()]

    mode = os.environ.get("NEWS_RSS_SYMBOL_MODE", "fixed").strip().lower()
    if mode == "ingest":
        scope, n = resolve_ingest_scope(None, None)
        rows = fetch_companies_for_ingest(conn, symbol_scope=scope, top_n=n)
        return [r["symbol"].upper() for r in rows]

    return list(FIXED_RSS_NEWS_SYMBOLS)


def db_conn():
    conf = Config.DB_CONFIG.copy()
    conf.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**conf)


def get_company_mapping(conn):
    """symbol -> first token of company name for text fallback."""
    mapping = {}
    with conn.cursor() as cur:
        cur.execute("SELECT symbol, company_name FROM company_profile")
        rows = cur.fetchall()
        for r in rows:
            sym = r["symbol"]
            name = r["company_name"]
            short_name = name.split(" ")[0].replace(",", "") if name else ""
            mapping[sym] = short_name
    return mapping


def auto_detect_symbol(title, content, mapping, default_symbol=None):
    """Infer ticker from title/body when RSS item has no symbol."""
    if default_symbol:
        return default_symbol

    combined_text = f"{title} {content}"
    for sym, short_name in mapping.items():
        if re.search(rf"\b{sym}\b", combined_text):
            return sym
        if short_name and len(short_name) > 3:
            if re.search(rf"\b{re.escape(short_name)}\b", combined_text, re.IGNORECASE):
                return sym
    return None


def extract_thumbnail(entry) -> str or None:
    try:
        if "media_content" in entry:
            return entry["media_content"][0]["url"]
        if "links" in entry:
            for link in entry["links"]:
                if "image" in link.get("type", ""):
                    return link.get("href")
    except Exception:
        pass
    return None


def fetch_article_content(url: str) -> Tuple[Optional[str], Optional[datetime]]:
    """Try newspaper3k, then news-please (same order/thresholds as all_in_one.fetch_article_content)."""
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) > 100:
            return article.text, article.publish_date
    except Exception:
        pass
    try:
        from newsplease import NewsPlease

        art = NewsPlease.from_url(url, timeout=15)
        if art and art.maintext and len(art.maintext) > 100:
            return art.maintext, art.date_publish
    except Exception:
        pass
    return None, None


def to_utc_aware(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def acquire_lock(cur, symbol: str) -> bool:
    cur.execute(
        """
        INSERT IGNORE INTO crawler_states (id, source, symbol, created_at, updated_at)
        VALUES (%s, %s, %s, UTC_TIMESTAMP(), UTC_TIMESTAMP())
    """,
        (str(uuid.uuid4()), SOURCE_NAME, symbol),
    )

    cur.execute(
        """
        UPDATE crawler_states
        SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s MINUTE),
            last_run_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
        WHERE source=%s AND symbol=%s
          AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP())
    """,
        (LOCK_MINUTES, SOURCE_NAME, symbol),
    )
    return cur.rowcount == 1


def crawl_symbol(conn, symbol: str, existing_sources: set[str], company_mapping: dict) -> dict:
    symbol = symbol.upper().strip()
    stats = {"symbol": symbol, "inserted": 0, "scanned": 0, "dup": 0, "fail": 0}

    with conn.cursor() as cur:
        if not acquire_lock(cur, symbol):
            return stats
        conn.commit()

        try:
            cur.execute(
                "SELECT last_published_at FROM crawler_states WHERE source=%s AND symbol=%s",
                (SOURCE_NAME, symbol),
            )
            state = cur.fetchone()
            last_pub = to_utc_aware(state["last_published_at"]) if state else None

            feed = feedparser.parse(RSS_TMPL.format(symbol=symbol))
            entries = feed.entries if hasattr(feed, "entries") else []
            newest_dt = last_pub

            prefix_pattern = re.compile(r"^news\s*:\s*", re.IGNORECASE)

            for e in entries[:MAX_SCAN_PER_SYMBOL]:
                if stats["inserted"] >= TARGET_PER_SYMBOL:
                    break

                stats["scanned"] += 1
                link = e.get("link", "").strip()
                pub_dt = None
                if hasattr(e, "published_parsed"):
                    pub_dt = to_utc_aware(datetime(*e.published_parsed[:6]))

                if last_pub and pub_dt and pub_dt <= last_pub:
                    continue
                if link in existing_sources:
                    continue

                clean_title = prefix_pattern.sub("", e.get("title", "")).strip()
                if not clean_title:
                    continue

                try:
                    body, parsed_pub = fetch_article_content(link)
                except Exception:
                    body, parsed_pub = None, None
                final_content = body if body else f"Brief: {clean_title}. Read more: {link}"
                if parsed_pub:
                    pub_dt = to_utc_aware(parsed_pub)

                detected_symbol = auto_detect_symbol(
                    clean_title, final_content, company_mapping, default_symbol=symbol
                )
                image_url = extract_thumbnail(e)
                author = e.get("author") or e.get("source", {}).get("title") or "Yahoo Finance"

                published_naive = None
                if pub_dt:
                    published_naive = pub_dt.replace(tzinfo=None)

                hkey = rss_hash_key(detected_symbol or symbol, link, clean_title)

                cur.execute(
                    """
                    INSERT IGNORE INTO knowledge_docs
                    (id, hash_key, title, content, published_at, image, category, symbol, source, author, language,
                     is_processed, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, 'article', %s, %s, %s, 'en', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """,
                    (
                        str(uuid.uuid4()),
                        hkey,
                        clean_title[:500],
                        final_content,
                        published_naive,
                        image_url,
                        detected_symbol,
                        link[:500],
                        author[:500],
                    ),
                )

                if cur.rowcount:
                    stats["inserted"] += 1
                else:
                    stats["dup"] += 1
                existing_sources.add(link)
                if pub_dt and (newest_dt is None or pub_dt > newest_dt):
                    newest_dt = pub_dt

                if stats["inserted"] % COMMIT_EVERY == 0:
                    conn.commit()
                time.sleep(SLEEP_SEC)

            cur.execute(
                """
                UPDATE crawler_states SET
                last_published_at=%s, last_run_at=UTC_TIMESTAMP(), locked_until=NULL, fail_count=0
                WHERE source=%s AND symbol=%s
            """,
                (newest_dt.replace(tzinfo=None) if newest_dt else None, SOURCE_NAME, symbol),
            )
            conn.commit()

        except Exception as ex:
            conn.rollback()
            logger.error("Error %s: %s", symbol, ex)
            cur.execute("UPDATE crawler_states SET locked_until=NULL WHERE symbol=%s", (symbol,))
            conn.commit()
            stats["fail"] = 1

    return stats


def run_yahoo_rss_crawl() -> Dict[str, int]:
    """
    Crawl Yahoo RSS for the configured symbol list and write ``knowledge_docs``.

    Returns aggregate stats: symbols, inserted, dup, scanned, fail.
    """
    conn = db_conn()
    totals = {"symbols": 0, "inserted": 0, "dup": 0, "scanned": 0, "fail": 0}
    try:
        symbols = list_rss_symbols(conn)
        if not symbols:
            logger.warning("RSS crawl: symbol list empty (check NEWS_RSS_SYMBOLS / NEWS_RSS_SYMBOL_MODE).")
            return totals

        company_mapping = get_company_mapping(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT source FROM knowledge_docs WHERE source IS NOT NULL")
            existing_sources = {r["source"] for r in cur.fetchall()}

        logger.info("Yahoo RSS crawl: %s symbols (%s…)", len(symbols), ", ".join(symbols[:5]))
        totals["symbols"] = len(symbols)
        for sym in symbols:
            st = crawl_symbol(conn, sym, existing_sources, company_mapping)
            totals["inserted"] += st["inserted"]
            totals["dup"] += st.get("dup", 0)
            totals["scanned"] += st["scanned"]
            totals["fail"] += st.get("fail", 0)
            logger.info(
                "RSS %s: inserted=%s dup=%s scanned=%s fail=%s",
                sym,
                st["inserted"],
                st.get("dup", 0),
                st["scanned"],
                st.get("fail", 0),
            )
        return totals
    finally:
        conn.close()


def main():
    out = run_yahoo_rss_crawl()
    print(
        f"Done: {out['symbols']} symbols, +{out['inserted']} inserted, "
        f"{out['dup']} dup-key skips, {out['scanned']} scanned, fail_flags={out['fail']}"
    )


if __name__ == "__main__":
    main()
