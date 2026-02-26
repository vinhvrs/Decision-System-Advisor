#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import time
import re
import html
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
import feedparser
from bs4 import BeautifulSoup


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

TIMEOUT = 15
SLEEP_SEC = 0.35
TARGET_ARTICLES = 10
MAX_SCAN_PER_SYMBOL = 120
OUT_FILE = "output.txt"

RSS_TMPL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"

BLOCKLIST_DOMAINS = {
    "consent.yahoo.com",
}

BLOCKLIST_URL_SUBSTR = [
    "consent.yahoo.com/v2/collectConsent",
]

BAD_CONTENT_PHRASES = [
    "Oops, something went wrong",
    "Your privacy is important to us",
    "Manage privacy settings",
    "Privacy dashboard",
    "Terms and Privacy Policy",
    "抱歉，發生錯誤",
]

MIN_CONTENT_CHARS = 600


def http_get(url: str):
    headers = {"User-Agent": USER_AGENT}
    return requests.get(url, headers=headers, timeout=TIMEOUT, allow_redirects=True)


def fetch_html(url: str):
    try:
        r = http_get(url)
        if r.status_code >= 400:
            return r.url, r.status_code, None
        return r.url, r.status_code, r.text
    except requests.RequestException:
        return url, 0, None


def extract_canonical(html_text: str):
    if not html_text:
        return None
    m = re.search(
        r'rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']',
        html_text,
        flags=re.I,
    )
    return m.group(1) if m else None


def extract_text(html_text: str):
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")

    for t in soup(["script", "style", "noscript", "svg", "footer", "header", "nav", "aside"]):
        t.decompose()

    article = soup.find("article")
    root = article if article else soup.body if soup.body else soup

    text = root.get_text(separator="\n", strip=True)
    text = html.unescape(text)

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)


def is_bad_content(text: str):
    if not text or len(text) < MIN_CONTENT_CHARS:
        return True
    lower = text.lower()
    for p in BAD_CONTENT_PHRASES:
        if p.lower() in lower:
            return True
    return False


def is_blocked(url: str):
    if any(s in url for s in BLOCKLIST_URL_SUBSTR):
        return True
    dom = urlparse(url).netloc.lower()
    if dom in BLOCKLIST_DOMAINS:
        return True
    return False


def pick_articles(symbol: str):
    rss = RSS_TMPL.format(symbol=symbol)
    feed = feedparser.parse(rss)
    entries = feed.entries or []

    results = []
    debug = {
        "scanned": 0,
        "fetch_fail": 0,
        "extract_fail": 0,
    }

    seen = set()

    for e in entries[:MAX_SCAN_PER_SYMBOL]:
        if len(results) >= TARGET_ARTICLES:
            break

        debug["scanned"] += 1

        link = (e.get("link") or "").strip()
        title = (e.get("title") or "").strip()
        published = (e.get("published") or "").strip()

        if not link or is_blocked(link):
            continue

        if link in seen:
            continue

        final_url, status, html_text = fetch_html(link)
        if not html_text:
            debug["fetch_fail"] += 1
            continue

        if is_blocked(final_url):
            continue

        if "/m/" in urlparse(final_url).path:
            canon = extract_canonical(html_text)
            if canon:
                f2, st2, html2 = fetch_html(canon)
                if html2:
                    final_url, html_text = f2, html2

        content = extract_text(html_text)

        if is_bad_content(content):
            debug["extract_fail"] += 1
            continue

        seen.add(link)

        results.append({
            "title": title,
            "published": published,
            "link": link,
            "final_url": final_url,
            "content": content
        })

        time.sleep(SLEEP_SEC)

    return rss, results, debug


def generate_report(symbols):
    lines = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")

    lines.append("Yahoo Finance RSS Feasibility Test (10 articles per stock)\n")
    lines.append(f"Generated at: {now}\n")
    lines.append("=" * 100 + "\n\n")

    for sym in symbols:
        rss, articles, debug = pick_articles(sym)

        lines.append(f"SYMBOL: {sym}\n")
        lines.append(f"RSS: {rss}\n")
        lines.append("-" * 100 + "\n")
        lines.append(f"RESULT: {len(articles)}/{TARGET_ARTICLES}\n")
        lines.append(f"DEBUG: {debug}\n\n")

        for i, a in enumerate(articles, 1):
            lines.append(f"[{i:02d}] TITLE: {a['title']}\n")
            lines.append(f"PUBLISHED: {a['published']}\n")
            lines.append(f"LINK: {a['link']}\n")
            lines.append(f"FINAL: {a['final_url']}\n\n")
            lines.append(a["content"] + "\n")
            lines.append("-" * 80 + "\n\n")

        lines.append("=" * 100 + "\n\n")

    return "".join(lines)


def main():
    args = sys.argv[1:]
    write_file = False

    if "--out" in args:
        write_file = True
        args.remove("--out")

    symbols = args if args else ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL"]

    report = generate_report(symbols)

    if write_file:
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Exported to {OUT_FILE}")
    else:
        print(report)


if __name__ == "__main__":
    main()