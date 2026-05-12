"""
Backfill **`history_advice`** only (destination table).

Source data: temporary period caches (refreshed often, not canonical history):
  - `snapshot_daily`
  - `snapshot_monthly`
  - `snapshot_annual`

Same symbol + same `as_of_ts`: **daily overwrites monthly overwrites annual** (finest period wins).

Run after snapshots exist, e.g. `python snapshot_build.py` then:
  python -m app.jobs.history_advice_backfill
"""
from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import pymysql

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))
from app.jobs.history_advice import calc_advice, clamp_score, ensure_table, upsert_rows
from config.settings import settings

# Whitelist only — these are the three fallback snapshot tables for current-period OHLCV JSON.
SNAPSHOT_TABLES_COARSE_TO_FINE: Tuple[str, ...] = (
    "snapshot_annual",
    "snapshot_monthly",
    "snapshot_daily",
)


def db_connect():
    cfg = settings.DB_CONFIG.copy()
    cfg.setdefault("cursorclass", pymysql.cursors.DictCursor)
    return pymysql.connect(**cfg)


def _parse_ts(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(s[:26].replace("Z", ""), fmt.replace(".%f", ""))
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00").split("+")[0])
    except ValueError:
        return None


def scores_from_window(closes: List[float], volumes: List[float]) -> Optional[Tuple[float, float, float, float, float, float]]:
    """OHLCV-derived scores; works for short series (monthly/annual) with adaptive lookbacks."""
    n = len(closes)
    if n < 8:
        return None
    c0 = closes[-1]
    off10 = min(10, max(1, n - 1))
    off20 = min(20, max(1, n - 1))
    off60 = min(60, max(1, n - 1))
    c10 = closes[-1 - off10] if n > off10 else closes[0]
    c20 = closes[-1 - off20] if n > off20 else closes[0]
    c60 = closes[-1 - off60] if n > off60 else closes[0]

    ret10 = ((c0 - c10) / c10 * 100.0) if c10 > 0 else 0.0
    ret20 = ((c0 - c20) / c20 * 100.0) if c20 > 0 else 0.0
    ret60 = ((c0 - c60) / c60 * 100.0) if c60 > 0 else 0.0

    momentum = clamp_score(3.0 + ret10 / 10.0)
    growth = clamp_score(3.0 + ret20 / 15.0 + ret60 / 40.0)

    rets: List[float] = []
    start_k = max(1, n - min(25, n - 1))
    for k in range(start_k, n):
        if closes[k - 1] > 0:
            rets.append((closes[k] - closes[k - 1]) / closes[k - 1])
    if len(rets) >= 2:
        m = sum(rets) / len(rets)
        var = sum((x - m) ** 2 for x in rets) / len(rets)
        vol = math.sqrt(var) * 100.0
        stability = clamp_score(4.1 - min(vol * 2.2, 3.2))
    else:
        stability = 3.0

    win = closes[-60:] if n >= 60 else closes
    hi, lo = max(win), min(win)
    pos = (c0 - lo) / (hi - lo) if hi > lo else 0.5
    value = clamp_score(2.3 + (1.0 - pos) * 2.4)

    quality = clamp_score(3.0 + (stability - 3.0) * 0.35 + (value - 3.0) * 0.25)

    vol_recent = volumes[-20:] if len(volumes) >= 20 else volumes
    if len(vol_recent) >= 10 and sum(vol_recent) > 0:
        avg_v = sum(vol_recent[:-1]) / max(1, len(vol_recent) - 1)
        last_v = vol_recent[-1]
        vr = (last_v / avg_v) if avg_v > 0 else 1.0
        sentiment = clamp_score(3.0 + min(max(math.log(vr + 0.01) * 1.2, -1.2), 1.2))
    else:
        sentiment = 3.0

    return value, quality, growth, momentum, stability, sentiment


def _note_for_advice(advice: str) -> str:
    if advice == "BUY":
        return "Good long-horizon setup."
    if advice == "HOLD":
        return "Balanced profile; keep position sizing disciplined."
    return "Higher uncertainty; monitor before adding."


def _fetch_snapshot_table(conn, table: str) -> List[dict]:
    if table not in SNAPSHOT_TABLES_COARSE_TO_FINE:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT UPPER(TRIM(symbol)) AS sym, candles
                FROM `{table}`
                WHERE candles IS NOT NULL
                  AND candles != '[]'
                """
            )
            return list(cur.fetchall() or [])
    except pymysql.err.ProgrammingError:
        return []


def _iter_rows_for_symbol_candles(
    sym: str,
    candles: List[Any],
    *,
    step: int,
    min_parsed: int,
    now: datetime,
) -> List[tuple]:
    parsed: List[Tuple[float, float, Any]] = []
    for c in candles:
        cl = c.get("close")
        if cl is None:
            continue
        try:
            fc = float(cl)
        except (TypeError, ValueError):
            continue
        try:
            fv = float(c.get("volume") or 0)
        except (TypeError, ValueError):
            fv = 0.0
        parsed.append((fc, fv, c.get("timestamp")))

    if len(parsed) < max(8, min_parsed):
        return []

    closes = [p[0] for p in parsed]
    vols = [p[1] for p in parsed]
    out: List[tuple] = []
    # scores_from_window needs 8 closes; index i ⇒ window length i+1
    start_i = max(7, min_parsed - 1)
    if start_i >= len(parsed):
        return []
    for i in range(start_i, len(parsed), max(1, step)):
        sub_c = closes[: i + 1]
        sub_v = vols[: i + 1]
        scored = scores_from_window(sub_c, sub_v)
        if not scored:
            continue
        value, quality, growth, momentum, stability, sentiment = scored
        advice = calc_advice(value, quality, growth, momentum, stability, sentiment)
        note = _note_for_advice(advice)
        ts = _parse_ts(parsed[i][2])
        if ts is None:
            continue
        as_of = ts.replace(hour=0, minute=0, second=0, microsecond=0)
        out.append(
            (
                as_of,
                sym,
                value,
                quality,
                growth,
                momentum,
                stability,
                sentiment,
                advice,
                note,
                now,
                now,
            )
        )
    return out


def snapshot_table_options(table: str) -> Tuple[int, int]:
    """(step between sampled candles, minimum parsed bars — must be >= 8 for scoring)."""
    if table == "snapshot_daily":
        return 5, 12
    if table == "snapshot_monthly":
        return 2, 8
    if table == "snapshot_annual":
        return 1, 8
    return 5, 12


def merged_rows_from_all_snapshots(conn) -> List[tuple]:
    """
    Read annual → monthly → daily; merge by (as_of_ts, symbol) so **daily wins**.
    """
    now = datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None)
    merged: Dict[Tuple[datetime, str], tuple] = {}

    for table in SNAPSHOT_TABLES_COARSE_TO_FINE:
        step, min_parsed = snapshot_table_options(table)
        rows = _fetch_snapshot_table(conn, table)
        for row in rows:
            sym = str(row.get("sym") or "").strip().upper()
            raw = row.get("candles")
            if not sym or not raw:
                continue
            try:
                candles = json.loads(raw) if isinstance(raw, str) else raw
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(candles, list) or len(candles) < 2:
                continue
            for tup in _iter_rows_for_symbol_candles(
                sym, candles, step=step, min_parsed=min_parsed, now=now
            ):
                key = (tup[0], str(tup[1]))
                merged[key] = tup

    return list(merged.values())


def main():
    conn = db_connect()
    try:
        ensure_table(conn)
        rows = merged_rows_from_all_snapshots(conn)
        if not rows:
            print(
                "history_advice_backfill: no rows. Populate snapshot_daily / snapshot_monthly / "
                "snapshot_annual (e.g. python snapshot_build.py), then re-run."
            )
            return
        upsert_rows(conn, rows)
        print(
            f"history_advice_backfill: upserted {len(rows)} rows into history_advice "
            f"(sources: {', '.join(SNAPSHOT_TABLES_COARSE_TO_FINE)}; finest period wins on duplicate dates)."
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
