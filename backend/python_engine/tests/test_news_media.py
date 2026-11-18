import unittest
from unittest.mock import patch

from app.jobs news_media


class FakeResponse:
    def __init__(self, status_code=200, text="", content=b"", headers=None):
        self.status_code = status_code
        self.text = text
        self.content = content
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class FakeCursor:
    def __init__(self, rows=None): self.rows = list(rows or []); self.executed = []
    def execute(self, sql, params=None): self.executed.append((sql, params))
    def fetchone(self): return self.rows.pop(0) if self.rows else None
    def fetchall(self): return self.rows


class FakeConn:
    def __init__(self, rows=None): self.cur = FakeCursor(rows); self.committed = False
    def cursor(self):
        conn = self
        class CM:
            def __enter__(_self): return conn.cur
            def __exit__(_self, *args): return False
        return CM()
    def commit(self): self.committed = True
    def __enter__(self): return self
    def __exit__(self, *args): return False


class NewsMediaTest(unittest.TestCase):
    def test_parse_og_and_caption_credit(self):
        html = """<html><head>
        <meta property='og:image' content='https://images.example.com/hero.jpg'>
        <meta property='og:image:alt' content='Photo: Jane Smith/ACME News'>
        </head></html>"""
        items = news_media._parse_media(html, "https://example.com/a", "example.com")
        self.assertEqual(float(items[0]["width"]), None)
        self.assertEqual(items[0]["caption"], "Photo: Jane Smith/ACME News")
        self.assertIn(items[0]["kind"], ("hero", "inline"))

    def test_non_image_content_type_fails(self):
        with patch("app.jobs.news_media.requests.get", return_value=FakeResponse(headers={"Content-Type": "text/html"})):
            self.assertEqual(news_media._probe_image("https://example.com/foo"), False)

    def test_status_threshold(self):
        self.assertTrue(news_media._needs_media_check({"media_checked_at": None}))
        self.assertFalse(news_media._needs_media_check({"media_checked_at": "2026-01-01 00:00:00", "media_attempts": 0}))
        self.assertTrue(news_media._needs_media_check({"media_checked_at": "2026-01-01 00:00:00", "media_attempts": 1, "hero_image": None}))

    def test_refresh_persists_verified_media_only(self):
        rows = [{"id": "a", "url": "https://news.example/a", "publisher": "example.com", "media_attempts": 0}]
        conn = FakeConn(rows)
        with patch.object(news_media.pymysql, "connect", return_value=conn), \
             patch.object(news_media, "_fetch_html", return_value="<meta property='og:image' content='https://i.example/a.jpg'>"), \
             patch.object(news_media, "_probe_image", return_value=True):
            summary = news_media.refresh_news_media(limit=1)
        self.assertEqual(summary["checked"], 1)
        updates = [x for x in conn.cur.executed if str(x[0]).strip().upper().startswith("UPDATE NEWS_ARTICLES")]
        self.assertTrue(updates)
        self.assertTrue(conn.committed)
