from __future__ import annotations

from typing import Dict, Optional

from snapshot_build import build_snapshots


def run_snapshot_update(symbol_scope: Optional[str] = None, top_n: Optional[int] = None) -> Dict:
    """
    Refresh snapshot_daily, snapshot_monthly, snapshot_annual.
    Rule: each update run recalculates daily and then monthly+annual in the same pass.
    """
    return build_snapshots(symbol_scope=symbol_scope, top_n=top_n)


if __name__ == "__main__":
    print(run_snapshot_update())

