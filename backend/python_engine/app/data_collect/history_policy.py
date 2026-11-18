from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class HistoryFetchPlan:
    mode: str
    days: Optional[int] = None
    period: Optional[str] = None


def choose_history_fetch_plan(
    *,
    existing_daily_bars: int,
    backfill_days: Optional[int],
    history_period: str,
    bootstrap_min_bars: int,
    bootstrap_days: int,
) -> HistoryFetchPlan:
    """
    Decide whether a symbol needs a long bootstrap or only a short incremental fetch.

    Explicit/manual backfill always wins. Scheduled sync bootstraps only while
    persisted daily coverage is below the configured minimum.
    """
    existing = max(0, int(existing_daily_bars))
    min_bars = max(2, int(bootstrap_min_bars))
    bootstrap = max(30, int(bootstrap_days))

    if backfill_days is not None:
        return HistoryFetchPlan(mode="manual", days=max(1, int(backfill_days)))

    if existing < min_bars:
        return HistoryFetchPlan(mode="bootstrap", days=bootstrap)

    period = str(history_period or "7d").strip() or "7d"
    return HistoryFetchPlan(mode="incremental", period=period)


def prioritize_by_history_coverage(
    instruments: list[dict],
    coverage_by_instrument_id: dict[str, int],
    *,
    preserve_input_order: bool = False,
) -> list[dict]:
    """
    Put the least-covered symbols first so rate limits/interrupted scheduled runs
    cannot permanently starve the same tail of the universe.

    Explicit/manual symbol requests preserve caller order.
    """
    items = list(instruments)
    if preserve_input_order or len(items) <= 1:
        return items

    def _key(item: dict):
        instrument_id = str(item.get("id") or "")
        symbol = str(item.get("symbol") or "").strip().upper()
        try:
            coverage = max(0, int(coverage_by_instrument_id.get(instrument_id, 0)))
        except (TypeError, ValueError):
            coverage = 0
        return (coverage, symbol)

    return sorted(items, key=_key)
