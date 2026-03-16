import hashlib
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pymysql
import requests
import yfinance as yf
from newspaper import Article

from config.settings import Config
from app.pipeline.pipeline_processor import calculate_price_impact

logger = logging.getLogger(__name__)

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

BLACKLIST = re.compile(
    r"(?i)(zacks rank|should you buy|stock of the day|market wrap|what to watch|"
    r"opinion|dow jones|s&p 500|wall street fell|wall street hits|buy or sell|"
    r"is it too late|top stocks|stocks to watch)"
)

EVENT_TRIGGERS = re.compile(
    r"(?i)(earnings|revenue|guidance|q[1-4]|dividend|launches|unveils|"
    r"acquires|merger|partnership|secures|resigns|steps down|lawsuit|sued|"
    r"fda approval|layoffs|cuts jobs|bankruptcy)"
)

PATTERN_RULES = {
    "EARNINGS": r"\b(earnings|q[1-4]|revenue|guidance)\b",
    "PRODUCT": r"\b(launches|unveils|releases|new product)\b",
    "M&A": r"\b(acquires|merger|partnership|takeover)\b",
    "REGULATORY": r"\b(fda|lawsuit|sec|sued|investigation)\b",
    "MACRO": r"\b(fed|interest rate|inflation|cpi)\b",
    "MANAGEMENT": r"\b(ceo|resigns|steps down|layoffs)\b",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def get_db_connection():
    db_params = Config.DB_CONFIG.copy()
    if "cursorclass" not in db_params:
        db_params["cursorclass"] = pymysql.cursors.DictCursor
    return pymysql.connect(**db_params)


def get_all_companies() -> List[Dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT symbol, company_name
                FROM company_profile
                WHERE symbol IS NOT NULL
                  AND company_name IS NOT NULL
                """
            )
            return cursor.fetchall()
    finally:
        conn.close()


def generate_doc_id(symbol: str, title: str, published_at, url: str) -> str:
    raw = f"{(symbol or '').strip().upper()}|{title}|{published_at}|{url}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def normalize_company_tokens(company_name: str) -> List[str]:
    tokens = re.findall(r"\w+", (company_name or "").lower())
    stop = {"inc", "corp", "corporation", "company", "co", "plc", "ltd", "group", "holdings", "the"}
    return [t for t in tokens if len(t) > 2 and t not in stop]


def is_valuable_event(title: str, symbol: str, company_name: str) -> bool:
    if not title:
        return False

    title_lower = title.lower()
    symbol_lower = (symbol or "").lower()
    company_tokens = normalize_company_tokens(company_name)

    has_symbol = bool(re.search(rf"\b{re.escape(symbol_lower)}\b", title_lower))
    has_company = any(tok in title_lower for tok in company_tokens[:2])

    if not (has_symbol or has_company):
        return False

    if BLACKLIST.search(title_lower):
        return False

    if not EVENT_TRIGGERS.search(title_lower):
        return False

    return True


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


def extract_pattern_type(title: str) -> str:
    title_lower = (title or "").lower()
    for pattern_type, regex in PATTERN_RULES.items():
        if re.search(regex, title_lower):
            return pattern_type
    return "GENERAL"


def save_to_knowledge_docs(
    conn,
    doc_id: str,
    symbol: str,
    title: str,
    content: str,
    published_at,
    url: str,
) -> None:
    with conn.cursor() as cursor:
        sql = """
            INSERT IGNORE INTO knowledge_docs_temp
            (id, symbol, title, content, published_at, source, is_processed)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            sql,
            (doc_id, symbol, title, content, published_at, url, 1),
        )


def save_to_inference_results(conn, event: Dict, source_name: str = "GDELT") -> None:
    if event["candles_elapsed"] < 7:
        rec = "Maybe up trend" if event["pre_trend"] > 0 else "Maybe down trend"
        status = "PENDING"
    else:
        rec = "BUY" if event["post_trend"] > 1.5 else ("SELL" if event["post_trend"] < -1.5 else "HOLD")
        status = "COMPLETED"

    inference_id = generate_doc_id(
        event["symbol"],
        event["title"],
        event["published_at"],
        f"{source_name}|{event.get('doc_id', '0')}",
    )

    with conn.cursor() as cursor:
        sql = """
            INSERT IGNORE INTO knowledge_inference_results
            (id, symbol, doc_id, title, published_at, pre_trend, post_trend,
             recommendation, pattern_type, status, candles_elapsed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(
            sql,
            (
                inference_id,
                event["symbol"],
                event.get("doc_id", "0"),
                event["title"][:450],
                event["published_at"],
                event["pre_trend"],
                event["post_trend"],
                rec,
                event.get("pattern_type", "GENERAL"),
                status,
                event.get("candles_elapsed", 0),
            ),
        )


def fetch_content_waterfall(url: str, title: str) -> Tuple[str, Optional[datetime]]:
    try:
        article = Article(url)
        article.download()
        article.parse()
        if article.text and len(article.text) > 150:
            return article.text, article.publish_date
    except Exception:
        pass

    return f"News Brief: {title}. Full article content available at: {url}", None


def request_gdelt_chunk(
    session: requests.Session,
    company_name: str,
    chunk_start: datetime,
    chunk_end: datetime,
    mode: str = "daily",
) -> Optional[Dict]:
    params = {
        "query": f'"{company_name}" stock',
        "mode": "ArtList",
        "maxrecords": 75,
        "format": "json",
        "startdatetime": chunk_start.strftime("%Y%m%d%H%M%S"),
        "enddatetime": chunk_end.strftime("%Y%m%d%H%M%S"),
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            res = session.get(GDELT_URL, params=params, headers=HEADERS, timeout=45)

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
                logger.warning(
                    "GDELT returned HTTP %s. Retry %d/%d after %ss.",
                    res.status_code,
                    attempt + 1,
                    max_retries,
                    wait_time,
                )
                time.sleep(wait_time)
                continue

            return res.json()

        except requests.RequestException as e:
            wait_time = 10 * (attempt + 1)
            logger.warning(
                "GDELT request failed: %s. Retry %d/%d after %ss.",
                e,
                attempt + 1,
                max_retries,
                wait_time,
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
    logger.info("Sliding Window: %s <- %s", start_dt.date(), end_dt.date())

    own_session = False
    if session is None:
        session = requests.Session()
        own_session = True

    try:
        current_chunk_end = end_dt
        while current_chunk_end > start_dt:
            current_chunk_start = max(current_chunk_end - timedelta(days=30), start_dt)
            logger.info(
                "Scanning GDELT for %s: %s to %s",
                symbol,
                current_chunk_start.date(),
                current_chunk_end.date(),
            )

            payload = request_gdelt_chunk(
                session=session,
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

                    try:
                        pub_date = datetime.strptime(art["seendate"], "%Y%m%dT%H%M%SZ")
                    except Exception:
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
                    "%s raw -> %s filtered -> %s unique for %s",
                    len(articles),
                    len(valid_articles),
                    len(unique_articles),
                    symbol,
                )

                if unique_articles:
                    conn = get_db_connection()
                    try:
                        for art in unique_articles:
                            url = art.get("url")
                            if not url:
                                continue

                            logger.info("Fetching content: %s", art["title"][:80])
                            content, _ = fetch_content_waterfall(url, art["title"])

                            if not content or len(content) < 100:
                                continue

                            doc_id = generate_doc_id(symbol, art["title"], art["published_at"], url)

                            save_to_knowledge_docs(
                                conn=conn,
                                doc_id=doc_id,
                                symbol=symbol,
                                title=art["title"],
                                content=content,
                                published_at=art["published_at"],
                                url=url,
                            )

                            pre, post, trade_date, elapsed = calculate_price_impact(art["published_at"], symbol)

                            if trade_date:
                                save_to_inference_results(
                                    conn=conn,
                                    event={
                                        "doc_id": doc_id,
                                        "symbol": symbol,
                                        "title": art["title"],
                                        "published_at": art["published_at"],
                                        "pre_trend": pre,
                                        "post_trend": post,
                                        "pattern_type": extract_pattern_type(art["title"]),
                                        "candles_elapsed": elapsed,
                                    },
                                    source_name="GDELT",
                                )

                        conn.commit()
                    finally:
                        conn.close()

            except Exception as e:
                logger.exception("Parsing Error for %s: %s", symbol, e)

            time.sleep(2 if mode == "daily" else 15)
            current_chunk_end = current_chunk_start - timedelta(seconds=1)

    finally:
        if own_session:
            session.close()


def fetch_corporate_actions(
    symbol: str,
    company_name: str,
    start_dt: Optional[datetime] = None,
    end_dt: Optional[datetime] = None,
) -> None:
    logger.info("Fetching Corporate Actions for %s", symbol)
    try:
        tk = yf.Ticker(symbol)
        actions = tk.actions
        if actions.empty:
            return

        if start_dt is not None:
            actions = actions[actions.index >= start_dt]
        if end_dt is not None:
            actions = actions[actions.index <= end_dt]

        if actions.empty:
            return

        conn = get_db_connection()
        try:
            for date, row in actions.iterrows():
                event_type = "Dividend" if row.get("Dividends", 0) > 0 else "Stock Split"
                value = row.get("Dividends", 0) if event_type == "Dividend" else row.get("Stock Splits", 0)
                title = f"[{symbol}] Corporate Action: {event_type} of {value}"

                impact_result = calculate_price_impact(date, symbol)
                if len(impact_result) == 4:
                    pre, post, trade_date, elapsed = impact_result
                else:
                    pre, post, trade_date = impact_result
                    elapsed = 7

                if not trade_date:
                    continue

                doc_id = generate_doc_id(symbol, title, date, "YFinance_Action")

                save_to_knowledge_docs(
                    conn=conn,
                    doc_id=doc_id,
                    symbol=symbol,
                    title=title,
                    content=f"Official corporate action data from Yahoo Finance: {event_type} of {value}",
                    published_at=date,
                    url="YFinance_Action",
                )

                save_to_inference_results(
                    conn=conn,
                    event={
                        "doc_id": doc_id,
                        "symbol": symbol,
                        "title": title,
                        "published_at": date,
                        "pre_trend": pre,
                        "post_trend": post,
                        "pattern_type": "CORPORATE_ACTION",
                        "candles_elapsed": elapsed,
                    },
                    source_name="YFinance",
                )

            conn.commit()
        finally:
            conn.close()

    except Exception as e:
        logger.exception("Corporate Action Error for %s: %s", symbol, e)


def run_daily_update(lookback_days: int = 1) -> None:
    companies = get_all_companies()
    if not companies:
        logger.error("No companies found in database.")
        return

    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=lookback_days)

    session = requests.Session()
    try:
        for co in companies:
            symbol = co["symbol"]
            company_name = co["company_name"]

            logger.info("=" * 60)
            logger.info("DAILY UPDATE: %s | %s -> %s", symbol, start_dt.date(), end_dt.date())

            fetch_corporate_actions(symbol, company_name, start_dt, end_dt)
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
        session.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    run_daily_update(lookback_days=1)