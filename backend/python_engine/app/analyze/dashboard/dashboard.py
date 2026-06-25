"""
Build a JSON dashboard payload (ranking board + metadata) and store it in Redis.

Key: ``dashboard`` (Redis DB from ``REDIS_DB`` in ``python_engine/.env``).

Each ranking row includes:
  - name / symbol — company display name and ticker
  - change — daily snapshot % change (open→close)
  - bias / suggestion — buy | sell | flat + short copy (informational, not advice)
  - str — count of “strong” radar attributes (scores ≥ 4 on five spokes, same as Laravel beginner board)
  - liquidity, care (watchlist saves)
  - chart — recent daily close prices for sparkline-style UI

Aligned with ``SnapshotService::beginnerRankingBoard`` / ``buildBeginnerRankingRowsFromSnapshotRows``.

Run from ``python_engine`` root::

    python -m app.analyze.dashboard.dashboard
    python -m app.analyze.dashboard.dashboard --limit 50
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# parents[0]=dashboard dir … parents[3]=python_engine
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pymysql
import redis

from config.settings import settings

from app.config.dsa_tables import table as dsa_table

logger = logging.getLogger(__name__)


def _ranking_snapshot_table() -> str:
    return dsa_table("instrument_snapshot")


def _ohlc_data_table() -> str:
    return dsa_table("instrument_data")


def _ohlc_period_table() -> str:
    return dsa_table("instrument_periods")


BEGINNER_STRONG_TRAIT_MIN_SCORE = 4
CHART_BARS = 40
CHART_BARS_DAILY = 90  # warm-up / dashboard:daily line chart
# TTL on each SET (default 3h). Override with ``DASHBOARD_DAILY_REDIS_TTL_SEC``.
# Refresh cadence: ``DASHBOARD_WARM_UP_INTERVAL_MINUTES`` in scheduler_config (default 5m).
DASHBOARD_TTL_SECONDS = int(
    os.environ.get("DASHBOARD_DAILY_REDIS_TTL_SEC", str(60 * 60 * 3))
)  # default 3h
REDIS_KEY_DAILY = "dashboard:daily"


def redis_dashboard_daily_ttl_seconds() -> Optional[int]:
    """
    Redis TTL for ``dashboard:daily``.
    Returns ``None`` if the key is absent or error; ``-1`` means no expiry (caller may treat as OK).
    """
    try:
        r = settings.redis_client()
        t = r.ttl(REDIS_KEY_DAILY)
        if t is None:
            return None
        return int(t)
    except Exception:
        logger.warning("Redis TTL check failed for %s", REDIS_KEY_DAILY, exc_info=True)
        return None


RADAR_AXES = ["Signal", "Price", "Change", "Volume", "Liquidity", "Watchers"]


def _redis_dashboard_key() -> str:
    """Literal key name as requested; override with env ``DASHBOARD_REDIS_KEY`` if you need a prefix."""
    return (os.environ.get("DASHBOARD_REDIS_KEY") or "dashboard").strip() or "dashboard"


def _analysis_key(symbol: str) -> str:
    return f"{settings.REDIS_PREFIX}:analysis:{(symbol or '').strip().upper()}"


def quintile_scores_by_symbol(symbol_to_value: Dict[str, float]) -> Dict[str, int]:
    pairs: List[Tuple[str, float]] = []
    for sym, v in symbol_to_value.items():
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(fv):
            continue
        pairs.append((str(sym), fv))
    n = len(pairs)
    if n == 0:
        return {}
    pairs.sort(key=lambda x: x[1])
    out: Dict[str, int] = {}
    for i, (sym, _) in enumerate(pairs):
        pct = (i + 0.5) / n
        out[sym] = int(max(1, min(5, math.ceil(pct * 5))))
    return out


def reputation_score_from_watchers(people_watching: int) -> int:
    if people_watching >= 200:
        return 5
    if people_watching >= 50:
        return 4
    if people_watching >= 10:
        return 3
    if people_watching >= 1:
        return 2
    return 1


def signal_quintile_from_percent(p: float) -> int:
    p = max(0.0, min(100.0, float(p)))
    if p >= 80.0:
        return 5
    if p >= 60.0:
        return 4
    if p >= 40.0:
        return 3
    if p >= 20.0:
        return 2
    return 1


def signal_spoke_from_confidence_or_watchers(
    confidence_0_100: Optional[float],
    people_watching: int,
) -> int:
    if confidence_0_100 is not None and math.isfinite(float(confidence_0_100)):
        return signal_quintile_from_percent(float(confidence_0_100))
    return reputation_score_from_watchers(people_watching)


def strong_count_five(scores: Dict[str, Any]) -> int:
    keys = ["reputation", "candle_change", "volume", "liquidity", "people_care"]
    n = 0
    for k in keys:
        v = scores.get(k)
        if v is not None and int(v) >= BEGINNER_STRONG_TRAIT_MIN_SCORE:
            n += 1
    return n


def parse_analysis_confidence(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(d, dict):
        return None
    c = d.get("confidence")
    if isinstance(c, (int, float)) and math.isfinite(float(c)):
        return float(c)
    if isinstance(c, dict):
        s = c.get("score")
        if isinstance(s, (int, float)) and math.isfinite(float(s)):
            return float(s)
    return None


def bias_suggestion(bias: str) -> str:
    if bias == "buy":
        return "Snapshot up day — informational only, not advice."
    if bias == "sell":
        return "Snapshot down day — informational only, not advice."
    return "Flat snapshot — no directional bias from open/close."


def beginner_vs_prev_close_abs_pct(
    conn: pymysql.connections.Connection,
    instrument_ids: List[str],
) -> Dict[str, float]:
    instrument_ids = [str(x) for x in dict.fromkeys(instrument_ids) if x]
    if not instrument_ids:
        return {}
    ph = ",".join(["%s"] * len(instrument_ids))
    d_tbl = _ohlc_data_table()
    p_tbl = _ohlc_period_table()
    sql = f"""
        SELECT instrument_id,
            MAX(CASE WHEN rn = 1 THEN c_last END) AS last_close,
            MAX(CASE WHEN rn = 2 THEN c_last END) AS prev_close
        FROM (
            SELECT p.instrument_id,
                CAST(d.close AS DECIMAL(20,10)) AS c_last,
                ROW_NUMBER() OVER (PARTITION BY p.instrument_id ORDER BY d.timestamps DESC) AS rn
            FROM {d_tbl} AS d
            INNER JOIN {p_tbl} AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
            WHERE p.instrument_id IN ({ph})
              AND d.close IS NOT NULL
        ) AS z
        WHERE rn <= 2
        GROUP BY instrument_id
    """
    out: Dict[str, float] = {}
    with conn.cursor() as cur:
        cur.execute(sql, instrument_ids)
        for row in cur.fetchall():
            iid = str(row["instrument_id"])
            try:
                last = float(row["last_close"] or 0)
                prev = float(row["prev_close"] or 0)
            except (TypeError, ValueError):
                continue
            if last > 0 and prev > 0:
                out[iid] = abs((last - prev) / prev * 100)
    return out


def fetch_daily_closes_for_charts(
    conn: pymysql.connections.Connection,
    instrument_ids: List[str],
    max_bars: int = CHART_BARS,
) -> Dict[str, List[float]]:
    instrument_ids = [str(x) for x in dict.fromkeys(instrument_ids) if x]
    if not instrument_ids:
        return {}
    ph = ",".join(["%s"] * len(instrument_ids))
    d_tbl = _ohlc_data_table()
    p_tbl = _ohlc_period_table()
    sql = f"""
        SELECT instrument_id, c_last, rn
        FROM (
            SELECT p.instrument_id AS instrument_id,
                CAST(d.close AS DECIMAL(20,10)) AS c_last,
                ROW_NUMBER() OVER (PARTITION BY p.instrument_id ORDER BY d.timestamps DESC) AS rn
            FROM {d_tbl} AS d
            INNER JOIN {p_tbl} AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
            WHERE p.instrument_id IN ({ph})
              AND d.close IS NOT NULL
        ) AS z
        WHERE rn <= %s
        ORDER BY instrument_id, rn DESC
    """
    buckets: Dict[str, List[float]] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(sql, (*instrument_ids, max_bars))
        for row in cur.fetchall():
            raw = row.get("c_last")
            if raw is None:
                continue
            try:
                v = float(raw)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(v):
                continue
            iid = str(row["instrument_id"])
            buckets[iid].append(round(v, 4))
    # oldest → newest for chart line
    return {iid: list(reversed(closes)) for iid, closes in buckets.items()}


def fetch_daily_last_prev_close(
    conn: pymysql.connections.Connection,
    instrument_ids: List[str],
) -> Dict[str, Tuple[float, Optional[float]]]:
    """
    Latest and previous daily close per instrument (same basis as profile chart math).
    Returns: instrument_id -> (last_close, prev_close_or_none)
    """
    instrument_ids = [str(x) for x in dict.fromkeys(instrument_ids) if x]
    if not instrument_ids:
        return {}
    ph = ",".join(["%s"] * len(instrument_ids))
    d_tbl = _ohlc_data_table()
    p_tbl = _ohlc_period_table()
    sql = f"""
        SELECT instrument_id,
            MAX(CASE WHEN rn = 1 THEN c_last END) AS last_close,
            MAX(CASE WHEN rn = 2 THEN c_last END) AS prev_close
        FROM (
            SELECT p.instrument_id,
                CAST(d.close AS DECIMAL(20,10)) AS c_last,
                ROW_NUMBER() OVER (PARTITION BY p.instrument_id ORDER BY d.timestamps DESC) AS rn
            FROM {d_tbl} AS d
            INNER JOIN {p_tbl} AS p ON p.id = d.instrument_period_id AND p.period = 'daily'
            WHERE p.instrument_id IN ({ph})
              AND d.close IS NOT NULL
        ) AS z
        WHERE rn <= 2
        GROUP BY instrument_id
    """
    out: Dict[str, Tuple[float, Optional[float]]] = {}
    with conn.cursor() as cur:
        cur.execute(sql, instrument_ids)
        for row in cur.fetchall():
            iid = str(row["instrument_id"])
            try:
                last = float(row["last_close"] or 0)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(last) or last <= 0:
                continue
            prev_raw = row.get("prev_close")
            prev: Optional[float] = None
            if prev_raw is not None:
                try:
                    pv = float(prev_raw)
                    if math.isfinite(pv) and pv > 0:
                        prev = pv
                except (TypeError, ValueError):
                    prev = None
            out[iid] = (last, prev)
    return out


def query_top_snapshot_rows(conn: pymysql.connections.Connection, limit: int) -> List[Dict[str, Any]]:
    limit = max(1, min(500, int(limit)))
    snap_tbl = _ranking_snapshot_table()
    sql_with_cp = f"""
        SELECT
            s.instrument_id,
            UPPER(TRIM(s.symbol)) AS symbol,
            s.price,
            s.volume,
            s.liquidity,
            s.change_pct,
            COALESCE(cp.company_name, s.symbol) AS company_name,
            cp.image AS company_logo
        FROM {snap_tbl} s
        LEFT JOIN company_profile cp ON UPPER(TRIM(cp.symbol)) = UPPER(TRIM(s.symbol))
        ORDER BY s.volume DESC
        LIMIT %s
    """
    sql_snapshot_only = f"""
        SELECT
            s.instrument_id,
            UPPER(TRIM(s.symbol)) AS symbol,
            s.price,
            s.volume,
            s.liquidity,
            s.change_pct,
            s.symbol AS company_name,
            NULL AS company_logo
        FROM {snap_tbl} s
        ORDER BY s.volume DESC
        LIMIT %s
    """
    with conn.cursor() as cur:
        try:
            cur.execute(sql_with_cp, (limit,))
        except Exception:
            cur.execute(sql_snapshot_only, (limit,))
        return list(cur.fetchall())


def watchlist_counts(conn: pymysql.connections.Connection, symbols: List[str]) -> Dict[str, int]:
    syms = [s.strip().upper() for s in symbols if (s or "").strip()]
    syms = list(dict.fromkeys(syms))
    if not syms:
        return {}
    ph = ",".join(["%s"] * len(syms))
    sql = f"""
        SELECT UPPER(TRIM(symbol)) AS sym, COUNT(*) AS c
        FROM watchlist
        WHERE UPPER(TRIM(symbol)) IN ({ph})
        GROUP BY UPPER(TRIM(symbol))
    """
    out: Dict[str, int] = {}
    try:
        with conn.cursor() as cur:
            cur.execute(sql, syms)
            for row in cur.fetchall():
                out[str(row["sym"])] = int(row["c"] or 0)
    except Exception as e:
        logger.warning("watchlist aggregate skipped: %s", e)
    return out


def fetch_confidence_batch(r: redis.Redis, symbols: List[str]) -> Dict[str, float]:
    if not symbols:
        return {}
    keys = [_analysis_key(s) for s in symbols]
    try:
        raw_vals = r.mget(keys)
    except Exception as e:
        logger.warning("Redis mget analysis failed: %s", e)
        return {}
    out: Dict[str, float] = {}
    for sym, raw in zip(symbols, raw_vals):
        c = parse_analysis_confidence(raw if isinstance(raw, str) else None)
        if c is not None:
            out[sym.upper()] = c
    return out


def build_ranking_rows(
    conn: pymysql.connections.Connection,
    redis_client: redis.Redis,
    snapshot_rows: List[Dict[str, Any]],
    *,
    chart_bars: int = CHART_BARS,
) -> List[Dict[str, Any]]:
    if not snapshot_rows:
        return []

    chart_bars = max(2, min(500, int(chart_bars)))
    symbols = [str(r["symbol"]).strip().upper() for r in snapshot_rows]
    watch = watchlist_counts(conn, symbols)
    iids = [str(r["instrument_id"]) for r in snapshot_rows]
    charts = fetch_daily_closes_for_charts(conn, iids, chart_bars)
    last_prev_close = fetch_daily_last_prev_close(conn, iids)
    conf_by_sym = fetch_confidence_batch(redis_client, symbols)

    by_symbol: Dict[str, Dict[str, Any]] = {}
    for r in snapshot_rows:
        sym = str(r["symbol"]).strip().upper()
        people = int(watch.get(sym, 0))
        iid = str(r["instrument_id"])

        logo = r.get("company_logo")
        logo_url = str(logo).strip() if logo else None

        snap_price = float(r.get("price") or 0)
        snap_change = float(r.get("change_pct") or 0)
        last_close, prev_close = last_prev_close.get(iid, (0.0, None))
        # Dashboard should reflect "today" style move: current snapshot price vs previous close.
        # If snapshot price is unavailable, fall back to latest daily close; if prev close missing,
        # keep snapshot-provided change.
        price = snap_price if snap_price > 0 else last_close
        if prev_close is not None and prev_close > 0 and price > 0:
            change_pct = (price - prev_close) / prev_close * 100.0
        else:
            change_pct = snap_change
        # Keep the Change spoke aligned with the displayed 24H % column.
        candle_move = abs(float(change_pct))
        chart_vals = [round(x, 4) for x in charts.get(iid, [])]
        if price > 0:
            # Keep sparkline aligned with displayed price by appending latest snapshot value.
            if not chart_vals or abs(chart_vals[-1] - round(price, 4)) > 1e-9:
                chart_vals = chart_vals + [round(price, 4)]
        if len(chart_vals) > chart_bars:
            chart_vals = chart_vals[-chart_bars:]

        by_symbol[sym] = {
            "instrument_id": iid,
            "company_name": str(r.get("company_name") or sym),
            "logo_url": logo_url,
            "price": price,
            "volume": float(r.get("volume") or 0),
            "liquidity": float(r.get("liquidity") or 0),
            "change_pct": change_pct,
            "people_watching": people,
            "candle_move_abs_pct": round(candle_move, 4),
            "chart": chart_vals,
        }

    price_scores = quintile_scores_by_symbol({s: d["price"] for s, d in by_symbol.items() if d["price"] > 0})
    vol_scores = quintile_scores_by_symbol({s: d["volume"] for s, d in by_symbol.items()})
    liq_scores = quintile_scores_by_symbol({s: d["liquidity"] for s, d in by_symbol.items()})
    people_scores = quintile_scores_by_symbol({s: float(d["people_watching"]) for s, d in by_symbol.items()})
    candle_scores = quintile_scores_by_symbol({s: d["candle_move_abs_pct"] for s, d in by_symbol.items()})

    ranked: List[Dict[str, Any]] = []
    for sym, d in by_symbol.items():
        conf = conf_by_sym.get(sym)
        signal_spoke = signal_spoke_from_confidence_or_watchers(conf, d["people_watching"])
        watch_rep = reputation_score_from_watchers(d["people_watching"])

        scores = {
            "reputation": signal_spoke,
            "price_period": int(price_scores.get(sym, 3)),
            "candle_change": int(candle_scores.get(sym, 3)),
            "volume": int(vol_scores.get(sym, 3)),
            "liquidity": int(liq_scores.get(sym, 3)),
            "people_care": int(people_scores.get(sym, 3)),
            "watchlist_reputation": watch_rep,
            "analysis_confidence": conf,
        }
        sc = strong_count_five(scores)
        chg = round(float(d["change_pct"]), 2)
        bias = "buy" if chg > 0 else ("sell" if chg < 0 else "flat")

        radar = [
            {"subject": "Signal", "value": scores["reputation"]},
            {"subject": "Price", "value": scores["price_period"]},
            {"subject": "Change", "value": scores["candle_change"]},
            {"subject": "Volume", "value": scores["volume"]},
            {"subject": "Liquidity", "value": scores["liquidity"]},
            {"subject": "Watchers", "value": scores["people_care"]},
        ]

        ranked.append(
            {
                "symbol": sym,
                "company_name": d["company_name"],
                "logo_url": d["logo_url"],
                "strong_count": sc,
                "scores": scores,
                "radar": radar,
                "liquidity": round(d["liquidity"], 2),
                "volume": round(d["volume"], 2),
                "people_watching": d["people_watching"],
                "price": round(d["price"], 4),
                "candle_move_abs_pct": d["candle_move_abs_pct"],
                "change_pct_snapshot": chg,
                "day_bias": bias,
                # Flattened dashboard row (user-facing names)
                "name": d["company_name"],
                "change": chg,
                "bias": bias,
                "suggestion": bias_suggestion(bias),
                "str": sc,
                "care": d["people_watching"],
                "chart": d["chart"],
            }
        )

    # Str (strong_count) primary; tie-breakers match Laravel beginner board; symbol last for stable Redis diffs.
    ranked.sort(
        key=lambda row: (
            -row["strong_count"],
            -row["liquidity"],
            -row["volume"],
            -row["care"],
            row["symbol"],
        )
    )
    for i, row in enumerate(ranked):
        row["rank"] = i + 1
    return ranked


def compute_dashboard(limit: int = 20) -> Dict[str, Any]:
    cfg = settings.DB_CONFIG.copy()
    cfg["cursorclass"] = pymysql.cursors.DictCursor
    conn = pymysql.connect(**cfg)
    try:
        snapshot_rows = query_top_snapshot_rows(conn, limit)
        r = settings.redis_client()
        rows = build_ranking_rows(conn, r, snapshot_rows, chart_bars=CHART_BARS)
        return {
            "axes": RADAR_AXES,
            "ranking_board": rows,
            "rows": rows,
            "legend": {
                "strong_rule": "Str counts scores ≥ 4 on five radar spokes: Signal, Change, Volume, Liquidity, Watchers (Price is not counted).",
                "tie_break": "Pool = top symbols by snapshot volume. Tie-break: liquidity → volume → watchlist saves.",
                "buy_sell": "Bias uses the same daily snapshot % change as the dashboard (up vs down). Not financial advice.",
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        conn.close()


def _payload_float_match(a: Any, b: Any, *, abs_tol: float = 1e-4) -> bool:
    """Loose equality for JSON numeric fields (float rounding / Decimal vs float)."""
    try:
        fa = float(a)
        fb = float(b)
        if not math.isfinite(fa) or not math.isfinite(fb):
            return False
        return math.isclose(fa, fb, rel_tol=1e-9, abs_tol=abs_tol)
    except (TypeError, ValueError):
        return a == b


def validate_dashboard_daily_payload(
    payload: Dict[str, Any],
    *,
    chart_bars_max: int,
) -> tuple[bool, list[str]]:
    """
    Sanity-check payload before Redis SET: field consistency, Str recomputation, sort order, chart caps.
    Returns (ok, issue_messages).
    """
    issues: list[str] = []
    rows = payload.get("rows") or payload.get("ranking_board") or []
    if not rows:
        issues.append("no rows in payload")
        return False, issues

    str_sequence: list[int] = []
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            issues.append(f"row {i}: not an object")
            continue
        sym = row.get("symbol", "?")
        sc = row.get("str")
        sc_alt = row.get("strong_count")
        if sc != sc_alt:
            issues.append(f"{sym}: str ({sc}) != strong_count ({sc_alt})")
        scores = row.get("scores")
        if isinstance(scores, dict):
            recomputed = strong_count_five(scores)
            if sc != recomputed:
                issues.append(f"{sym}: str ({sc}) != recomputed from scores ({recomputed})")
        chg = row.get("change")
        chg2 = row.get("change_pct_snapshot")
        if not _payload_float_match(chg, chg2, abs_tol=1e-4):
            issues.append(f"{sym}: change ({chg}) != change_pct_snapshot ({chg2})")
        if row.get("bias") != row.get("day_bias"):
            issues.append(f"{sym}: bias != day_bias")
        if row.get("care") != row.get("people_watching"):
            issues.append(f"{sym}: care != people_watching")
        chart = row.get("chart")
        if not isinstance(chart, list):
            issues.append(f"{sym}: chart is not a list")
        else:
            if len(chart) > chart_bars_max:
                issues.append(f"{sym}: chart length {len(chart)} > max {chart_bars_max}")
            for j, pt in enumerate(chart):
                if isinstance(pt, bool) or not isinstance(pt, (int, float)):
                    issues.append(f"{sym}: chart[{j}] not numeric")
                    break
                if not math.isfinite(float(pt)):
                    issues.append(f"{sym}: chart[{j}] not finite")
                    break
        try:
            str_sequence.append(int(sc) if sc is not None else 0)
        except (TypeError, ValueError):
            issues.append(f"{sym}: str not int-compatible")
            str_sequence.append(0)

    if str_sequence != sorted(str_sequence, reverse=True):
        issues.append("rows are not sorted by str (strong_count) non-increasing")

    return len(issues) == 0, issues


def compute_dashboard_daily(limit: int = 100, chart_bars: int = CHART_BARS_DAILY) -> Dict[str, Any]:
    """
    Same ranking logic as ``compute_dashboard`` (sorted by ``str`` / strong_count first), with longer
    daily close series for ``dashboard:daily`` Redis payloads.
    """
    limit = max(1, min(500, int(limit)))
    chart_bars = max(2, min(500, int(chart_bars)))
    cfg = settings.DB_CONFIG.copy()
    cfg["cursorclass"] = pymysql.cursors.DictCursor
    conn = pymysql.connect(**cfg)
    try:
        snapshot_rows = query_top_snapshot_rows(conn, limit)
        r = settings.redis_client()
        rows = build_ranking_rows(conn, r, snapshot_rows, chart_bars=chart_bars)
        chart_lens = [len(r.get("chart") or []) for r in rows] if rows else []
        return {
            "axes": RADAR_AXES,
            "ranking_board": rows,
            "rows": rows,
            "legend": {
                "strong_rule": "Str counts scores ≥ 4 on five radar spokes: Signal, Change, Volume, Liquidity, Watchers (Price is not counted).",
                "tie_break": "Sorted by Str (strong trait count) descending, then liquidity, volume, watchlist saves, then symbol. Pool = top N symbols by snapshot volume.",
                "buy_sell": "Bias uses the same daily snapshot % change as the dashboard (up vs down). Not financial advice.",
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "python_engine:warm_up",
            "redis_key": REDIS_KEY_DAILY,
            "meta": {
                "pool_limit": limit,
                "chart_bars_requested": chart_bars,
                "row_count": len(rows),
                "chart_length_min": min(chart_lens) if chart_lens else 0,
                "chart_length_max": max(chart_lens) if chart_lens else 0,
            },
        }
    finally:
        conn.close()


def _redis_client() -> redis.Redis:
    return settings.redis_client()


def push_redis_payload(redis_key: str, payload: Dict[str, Any], ttl_seconds: int = DASHBOARD_TTL_SECONDS) -> bool:
    r = _redis_client()
    raw = json.dumps(payload, default=str, ensure_ascii=False)
    try:
        ok = r.set(redis_key, raw, ex=ttl_seconds)
        logger.info("Redis SET %s ex=%s bytes=%s ok=%s", redis_key, ttl_seconds, len(raw), ok)
        if ok and redis_key == REDIS_KEY_DAILY:
            try:
                from app.socket.events import notify_dashboard_daily_subscribers

                notify_dashboard_daily_subscribers(payload)
            except Exception:
                logger.warning("dashboard:daily WebSocket fan-out failed", exc_info=True)
        return bool(ok)
    except Exception as e:
        logger.error(
            "Redis SET %s failed (host=%s port=%s db=%s ssl=%s): %s",
            redis_key,
            settings.REDIS_HOST,
            settings.REDIS_PORT,
            settings.REDIS_DB,
            getattr(settings, "REDIS_USE_SSL", False),
            e,
            exc_info=True,
        )
        return False


def push_dashboard_to_redis(payload: Dict[str, Any]) -> bool:
    return push_redis_payload(_redis_dashboard_key(), payload)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Compute dashboard JSON and store under Redis dashboard key.")
    parser.add_argument("--limit", type=int, default=20, help="Top N symbols by snapshot volume (default 20, max 500)")
    args = parser.parse_args()
    payload = compute_dashboard(limit=args.limit)
    push_dashboard_to_redis(payload)
    print(f"Dashboard rows: {len(payload.get('ranking_board', []))} | key={_redis_dashboard_key()}")


if __name__ == "__main__":
    main()
