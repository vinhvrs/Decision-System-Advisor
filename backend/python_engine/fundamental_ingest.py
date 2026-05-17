"""CLI entry: run from ``backend/python_engine`` as ``python fundamental_ingest.py``."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure ``app.*`` imports resolve when executed as a loose script.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.pipeline.fundamental_ingest import main

if __name__ == "__main__":
    main()
