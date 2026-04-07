"""
Precompute the daily dashboard JSON and store it in Redis under ``dashboard:daily``.

Ranking board (sorted by ``str`` / strong_count first, same tie-breakers as ``dashboard`` module):
  name, symbol, change, bias, suggestion, str, liquidity, care, chart (≥90 daily closes by default).

Run from ``python_engine`` root (the folder that contains ``config/`` and ``app/``)::

    python -m app.warm_up.warm_up
    python -m app.warm_up.warm_up --limit 150 --chart-bars 120

Docker (example; use your service name and engine workdir, often ``/app``)::

    docker exec -w /app dsa-data-engine python -m app.warm_up.warm_up
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path


def _python_engine_root() -> Path:
    """Directory that contains ``config/settings.py`` (works in Docker and on the host)."""
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        if (d / "config" / "settings.py").is_file():
            return d
    # Fallback: app/warm_up → …/python_engine
    return Path(__file__).resolve().parents[2]


_ROOT = _python_engine_root()
# Must be first so `import app...` resolves (running `python app/warm_up/warm_up.py` does not set PYTHONPATH).
sys.path.insert(0, str(_ROOT))

from app.analyze.dashboard.dashboard import (  # noqa: E402
    REDIS_KEY_DAILY,
    compute_dashboard_daily,
    push_redis_payload,
    validate_dashboard_daily_payload,
)

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Warm Redis dashboard:daily from DB + analysis keys.")
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Top N symbols by snapshot volume to include (default 100, max 500)",
    )
    parser.add_argument(
        "--chart-bars",
        type=int,
        default=90,
        help="Number of daily closes per row for chart (default 90, min 2 max 500)",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Push even if internal consistency checks fail (not recommended).",
    )
    args = parser.parse_args()
    lim = max(1, min(500, int(args.limit)))
    chart_bars = max(2, min(500, int(args.chart_bars)))
    payload = compute_dashboard_daily(limit=lim, chart_bars=chart_bars)
    rows = payload.get("ranking_board") or payload.get("rows") or []

    ok_val, issues = validate_dashboard_daily_payload(payload, chart_bars_max=chart_bars)
    if issues:
        for msg in issues:
            (logger.error if not ok_val else logger.warning)("dashboard validate: %s", msg)
    if not ok_val and not args.skip_validation:
        raise SystemExit(1)

    ok = push_redis_payload(REDIS_KEY_DAILY, payload)
    meta = payload.get("meta") or {}
    print(
        f"Redis key={REDIS_KEY_DAILY} rows={len(rows)} ok={ok} "
        f"chart_len_min={meta.get('chart_length_min')} max={meta.get('chart_length_max')} "
        f"validate_ok={ok_val}"
    )


if __name__ == "__main__":
    main()
