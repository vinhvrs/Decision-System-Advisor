"""
GDELT ingest, title filtering / dedup, article body resolution, and scheduled pipelines.

RSS Yahoo crawl stays in ``news_crawler``. Set ``NEWS_HANDLE_ENABLED`` to turn this on.
"""
import hashlib
import json
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

from app.data_collect.collectors.news_crawler import db_conn, fetch_article_content, run_yahoo_rss_crawl
from app.data_collect.symbol_ingest import fetch_companies_for_ingest, resolve_ingest_scope

logger = logging.getLogger(__name__)

# Master switch: GDELT + run_daily_update / run_deep_news_backfill (off until explicitly enabled).
NEWS_HANDLE_ENABLED = False

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

GDELT_BLACKLIST = re.compile(
    r"(?i)(zacks rank|should you buy|stock of the day|market wrap|what to watch|"
    r"opinion|dow jones|s&p 500|wall street fell|wall street hits|buy or sell|"
    r"is it too late|top stocks|stocks to watch)"
)

GDELT_EVENT_TRIGGERS = re.compile(
    r"(?i)(earnings|revenue|guidance|q[1-4]|dividend|launches|unveils|"
    r"acquires|merger|partnership|secures|resigns|steps down|lawsuit|sued|"
    r"fda approval|layoffs|cuts jobs|bankruptcy)"
)

RELAXED_STOCK_NEWS = re.compile(
    r"(?i)\b(stock|stocks|shares?|investors?|trading|traders?|nasdaq|nyse|"
    r"quarter|quarterly|profit|loss|sales|revenue|forecast|guidance|"
    r"upgrade|downgrade|analyst|price target|eps|dividend|buyback|"
    r"ceo|cfo|chairman|board|reports?|announces?|warns?|beats?|miss(es)?)\b"
)

GDELT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def get_all_companies(
    symbol_scope: Optional[str] = None,
    top_n: Optional[int] = None,
) -> List[Dict]:
    """
    Companies for GDELT + corporate ingest.

    ``symbol_scope`` / ``top_n`` default from env ``SYMBOL_INGEST_MODE`` (``all`` | ``top_snapshot``)
    and ``SYMBOL_INGEST_TOP_N`` (default 20).
    """
    mode, n = resolve_ingest_scope(symbol_scope, top_n)
    conn = db_conn()
    try:
        return fetch_companies_for_ingest(conn, symbol_scope=mode, top_n=n)
    finally:
        conn.close()


def generate_doc_id(symbol: str, title: str, published_at, url: str) -> str:
    raw = f"{(symbol or '').strip().upper()}|{title}|{published_at}|{url}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def normalize_company_tokens(company_name: str) -> List[str]:
    tokens = re.findall(r"\w+", (company_name or "").lower())
    stop = {"inc", "corp", "corporation", "company", "co", "plc", "ltd", "group", "holdings", "the"}
    return [t for t in tokens if len(t) > 2 and t not in stop]


def parse_gdelt_seendate(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    s = str(raw).strip().rstrip("Z")
    attempts: List[Tuple[str, str]] = []
    if len(s) >= 15 and "T" in s:
        attempts.append((s[:15], "%Y%m%dT%H%M%S"))
    if len(s) >= 14 and s[:8].isdigit():
        attempts.append((s[:14], "%Y%m%d%H%M%S"))
    if len(s) >= 10 and s[4] == "-":
        attempts.append((s[:19], "%Y-%m-%dT%H:%M:%S"))
    if len(s) >= 8 and s[:8].isdigit():
        attempts.append((s[:8], "%Y%m%d"))
    for val, fmt in attempts:
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def build_gdelt_query(symbol: str, company_name: str) -> str:
    sym = (symbol or "").strip().upper()
    name = re.sub(r'["\']', " ", company_name or "")
    name = " ".join(name.split()).strip()[:140]
    if name and name.upper() != sym:
        return f"{sym} OR ({name})"
    return sym


def is_valuable_event(title: str, symbol: str, company_name: str) -> bool:
    if not title or len(title.strip()) < 12:
        return False

    title_lower = title.lower()
    symbol_lower = (symbol or "").lower()
    company_tokens = normalize_company_tokens(company_name)

    has_symbol = bool(re.search(rf"\b{re.escape(symbol_lower)}\b", title_lower))
    has_company = any(tok in title_lower for tok in company_tokens[:8])

    if not (has_symbol or has_company):
        return False

    if GDELT_BLACKLIST.search(title_lower):
        return False

    if GDELT_EVENT_TRIGGERS.search(title_lower):
        return True

    if RELAXED_STOCK_NEWS.search(title_lower):
        return True

    return False


def get_jaccard_similarity(text1: str, text2: str) -> float:
    set1 = set(re.findall(r"\w+", str(text1).lower()))
    set2 = set(re.findall(r"\w+", str(text2).lower()))
    if not set1 or not set2:
        return 0.0
    return len(set1.intersection(set2)) / len(set1.union(set2))


def deduplicate_news(articles: List[Dict], threshold: float = 0.45) -> List[Dict]:
    unique_events: List[Dict] = []
    for article in articles:
        is_duplicate = False
        for unique_event in unique_events:
            sim_score = get_jaccard_similarity(article["title"], unique_event["title"])
            if sim_score >= threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            unique_events.append(article)
    return unique_events


def save_gdelt_to_knowledge_docs(
    conn,
    doc_id: str,
    symbol: str,
    title: str,
    content: str,
    published_at,
    url: str,
) -> None:
    now = datetime.now()
    hash_key = doc_id if len(doc_id) == 32 else hashlib.md5(doc_id.encode("utf-8")).hexdigest()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT IGNORE INTO knowledge_docs
            (id, hash_key, title, content, published_at, image, category, symbol, source, author, language, created_at, updated_at, is_processed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                doc_id,
                hash_key,
                title,
                content,
                published_at,
                None,
                "article",
                symbol,
                url,
                None,
                "en",
                now,
                now,
                0,
            ),
        )


def fetch_content_waterfall(url: str, title: str) -> Tuple[str, Optional[datetime]]:
    content, p_date = fetch_article_content(url)
    if content:
        return content, p_date
    return f"Brief: {title}. Read more: {url}", None


def ensure_article_body(url: str, title: str) -> Optional[str]:
    text, _ = fetch_content_waterfall(url, title)
    text = (text or "").strip()
    if len(text) >= 60:
        return text
    try:
        host = urlparse(url).netloc or "publisher"
    except Exception:
        host = "publisher"
    stub = (
        f"{title.strip()}\n\n"
        f"Automated summary: full article text could not be extracted (publisher may block bots). "
        f"Source: {host}. The original URL is stored in the news record for reference."
    )
    return stub if len(stub) >= 60 else None


def request_gdelt_chunk(
    session: requests.Session,
    symbol: str,
    company_name: str,
    chunk_start: datetime,
    chunk_end: datetime,
    mode: str = "daily",
) -> Optional[Dict]:
    q = build_gdelt_query(symbol=symbol, company_name=company_name)
    params = {
        "query": f"({q}) (stock OR shares OR investor OR earnings OR nasdaq OR nyse OR company)",
        "mode": "ArtList",
        "maxrecords": 75,
        "format": "json",
        "startdatetime": chunk_start.strftime("%Y%m%d%H%M%S"),
        "enddatetime": chunk_end.strftime("%Y%m%d%H%M%S"),
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            res = session.get(GDELT_URL, params=params, headers=GDELT_HEADERS, timeout=45)

            if res.status_code == 429:
                sleep_time = (30 if mode == "daily" else 300) * (attempt + 1)
                logger.warning(
                    "HTTP 429 from GDELT. Sleeping %.1f minutes before retry %d/%d.",
                    sleep_time / 60,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(sleep_time)
                continue

            if res.status_code != 200:
                wait_time = 10 * (attempt + 1)
                snippet = (res.text or "")[:180].replace("\n", " ")
                logger.warning(
                    "GDELT HTTP %s (body prefix %r). Retry %d/%d after %ss.",
                    res.status_code,
                    snippet,
                    attempt + 1,
                    max_retries,
                    wait_time,
                )
                time.sleep(wait_time)
                continue

            raw = (res.text or "").strip()
            if not raw:
                wait_time = 10 * (attempt + 1)
                logger.warning(
                    "GDELT empty response body. Retry %d/%d after %ss.",
                    attempt + 1,
                    max_retries,
                    wait_time,
                )
                time.sleep(wait_time)
                continue

            try:
                return json.loads(raw)
            except json.JSONDecodeError as je:
                wait_time = 10 * (attempt + 1)
                logger.warning(
                    "GDELT not JSON (%s). First 160 chars: %r. Retry %d/%d after %ss.",
                    je,
                    raw[:160],
                    attempt + 1,
                    max_retries,
                    wait_time,
                )
                time.sleep(wait_time)
                continue

        except requests.RequestException as e:
            wait_time = 10 * (attempt + 1)
            hint = ""
            if "Connection refused" in str(e) or "Errno 111" in str(e):
                hint = " Check outbound HTTPS to api.gdeltproject.org (firewall/DNS/proxy). Set HTTPS_PROXY if required."
            elif "Failed to resolve" in str(e) or "Name or service not known" in str(e):
                hint = " Check DNS resolution for api.gdeltproject.org."
            logger.warning(
                "GDELT request failed: %s. Retry %d/%d after %ss.%s",
                e,
                attempt + 1,
                max_retries,
                wait_time,
                hint,
            )
            time.sleep(wait_time)

    return None


def fetch_and_fill_window(
    symbol: str,
    company_name: str,
    start_dt: datetime,
    end_dt: datetime,
    session: Optional[requests.Session] = None,
    mode: str = "daily",
) -> None:
    if not NEWS_HANDLE_ENABLED:
        return

    logger.info("GDELT window: %s <- %s", start_dt.date(), end_dt.date())

    own_session = False
    if session is None:
        session = requests.Session()
        own_session = True

    try:
        current_chunk_end = end_dt
        while current_chunk_end > start_dt:
            current_chunk_start = max(current_chunk_end - timedelta(days=30), start_dt)
            logger.info(
                "GDELT chunk %s: %s to %s",
                symbol,
                current_chunk_start.date(),
                current_chunk_end.date(),
            )

            payload = request_gdelt_chunk(
                session=session,
                symbol=symbol,
                company_name=company_name,
                chunk_start=current_chunk_start,
                chunk_end=current_chunk_end,
                mode=mode,
            )

            if not payload:
                logger.warning("Skip chunk %s due to repeated API failures.", current_chunk_start.date())
                current_chunk_end = current_chunk_start - timedelta(seconds=1)
                continue

            try:
                articles = payload.get("articles", [])
                valid_articles: List[Dict] = []

                for art in articles:
                    title = art.get("title", "")
                    if not is_valuable_event(title, symbol, company_name):
                        continue

                    pub_date = parse_gdelt_seendate(art.get("seendate"))
                    if not pub_date:
                        continue

                    valid_articles.append(
                        {
                            "title": title,
                            "url": art.get("url"),
                            "published_at": pub_date,
                        }
                    )

                unique_articles = deduplicate_news(valid_articles)
                logger.info(
                    "%s raw %s -> filtered %s -> unique %s",
                    symbol,
                    len(articles),
                    len(valid_articles),
                    len(unique_articles),
                )

                if unique_articles:
                    conn = db_conn()
                    try:
                        for art in unique_articles:
                            url = art.get("url")
                            if not url:
                                continue

                            logger.info("Fetching content: %s", art["title"][:80])
                            content = ensure_article_body(url, art["title"])
                            if not content:
                                continue

                            doc_id = generate_doc_id(symbol, art["title"], art["published_at"], url)
                            sym_upper = str(symbol).strip().upper()

                            try:
                                save_gdelt_to_knowledge_docs(
                                    conn=conn,
                                    doc_id=doc_id,
                                    symbol=sym_upper,
                                    title=art["title"],
                                    content=content,
                                    published_at=art["published_at"],
                                    url=url,
                                )
                            except Exception as exc:
                                logger.exception("knowledge_docs insert failed for %s: %s", sym_upper, exc)
                                continue

                        conn.commit()
                    finally:
                        conn.close()

            except Exception as e:
                logger.exception("GDELT parse error for %s: %s", symbol, e)

            time.sleep(2 if mode == "daily" else 15)
            current_chunk_end = current_chunk_start - timedelta(seconds=1)

    finally:
        if own_session:
            session.close()


def run_daily_update(
    lookback_days: int = 1,
    symbol_scope: Optional[str] = None,
    top_n: Optional[int] = None,
) -> None:
    """
    Scheduled ingest: Yahoo corporate actions (``stock_sync``) + optional GDELT, then Yahoo RSS → ``knowledge_docs``.

    ``symbol_scope`` / ``top_n`` select universe for corporate/GDELT (see ``get_all_companies``).
    RSS symbols come from ``news_crawler.list_rss_symbols`` (default: fixed 20-ticker demo list).
    Corporate sync runs when companies exist; GDELT only when ``NEWS_HANDLE_ENABLED`` is True.
    """
    from app.data_collect.collectors.stock_sync import sync_corporate_actions

    companies = get_all_companies(symbol_scope=symbol_scope, top_n=top_n)
    if not companies:
        logger.warning("No companies from ingest scope; corporate actions + GDELT loop skipped.")

    if not NEWS_HANDLE_ENABLED:
        logger.info("news_handle: GDELT/analysis disabled (NEWS_HANDLE_ENABLED=False); corporate sync only.")

    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=lookback_days)

    session = requests.Session() if NEWS_HANDLE_ENABLED else None
    try:
        for co in companies:
            symbol = co["symbol"]
            company_name = co["company_name"]

            logger.info("=" * 60)
            logger.info("NEWS INGEST: %s | %s -> %s", symbol, start_dt.date(), end_dt.date())

            sync_corporate_actions(symbol, company_name, start_dt, end_dt)
            if NEWS_HANDLE_ENABLED and session is not None:
                fetch_and_fill_window(
                    symbol=symbol,
                    company_name=company_name,
                    start_dt=start_dt,
                    end_dt=end_dt,
                    session=session,
                    mode="daily",
                )

            time.sleep(1)
    finally:
        if session is not None:
            session.close()

    try:
        rss_stats = run_yahoo_rss_crawl()
        logger.info("Yahoo RSS → knowledge_docs: %s", rss_stats)
    except Exception as e:
        logger.exception("Yahoo RSS crawl failed: %s", e)


def run_deep_news_backfill(
    limit_year: int = 2018,
    symbol_scope: Optional[str] = None,
    top_n: Optional[int] = None,
) -> None:
    """
    Historical GDELT windows + full corporate history (replaces ``all_in_one_v3.run_deep_fill_process``).
    """
    if not NEWS_HANDLE_ENABLED:
        logger.info("news_handle: run_deep_news_backfill skipped (NEWS_HANDLE_ENABLED=False).")
        return

    from app.data_collect.collectors.stock_sync import sync_corporate_actions

    companies = get_all_companies(symbol_scope=symbol_scope, top_n=top_n)
    if not companies:
        logger.error("No companies for deep backfill.")
        return

    for co in companies:
        symbol = co["symbol"]
        company_name = co["company_name"]
        logger.info("%s\n[backfill] %s", "=" * 60, symbol)

        sync_corporate_actions(symbol, company_name)

        conn = db_conn()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT MIN(published_at) AS oldest
                    FROM knowledge_docs
                    WHERE symbol = %s
                      AND IFNULL(source, '') != 'YFinance_Action'
                    """,
                    (symbol,),
                )
                res = cursor.fetchone()
                current_end = res["oldest"] if res and res["oldest"] else datetime.now()
        finally:
            conn.close()

        target_limit = datetime(limit_year, 1, 1)
        logger.info("[backfill] oldest anchor %s | target >= %s", current_end.date(), limit_year)

        session = requests.Session()
        try:
            while current_end > target_limit:
                current_start = current_end - timedelta(days=365)
                fetch_and_fill_window(
                    symbol,
                    company_name,
                    current_start,
                    current_end,
                    session=session,
                    mode="backfill",
                )
                current_end = current_start
                logger.info("[backfill] next anchor %s", current_end.date())
                time.sleep(3)
        finally:
            session.close()


__all__ = [
    "NEWS_HANDLE_ENABLED",
    "run_daily_update",
    "run_deep_news_backfill",
    "get_all_companies",
    "fetch_and_fill_window",
]
