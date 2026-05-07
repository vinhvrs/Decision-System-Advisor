"""
Backward-compatible shim.

Use `app.storage.snapshot_update` instead of this legacy module path.
"""

from app.storage.snapshot_update import run_snapshot_update


if __name__ == "__main__":
    print(run_snapshot_update())

