"""CLI: ``python news_ingest.py backfill`` / ``daily`` / ``rss`` from ``backend/python_engine``."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.pipeline.news_ingest_cli import main

if __name__ == "__main__":
    raise SystemExit(main())
