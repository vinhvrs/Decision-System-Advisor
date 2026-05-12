"""
Demo: simulate ``users`` + ``watchlist``, then denormalize watch counts onto ``instrument_snapshot``.

Adds ``instrument_snapshot.in_watchlist`` via ``ALTER TABLE`` when missing (no Laravel migration).
The count is ``SELECT COUNT(*) FROM watchlist WHERE symbol = snapshot.symbol`` (all users).

Usage (from ``backend/python_engine``)::

    python storage/feed_data.py --confirm --users 1000000 --batch-size 4000 --clean

    # Only recompute counts from existing watchlist rows:
    python storage/feed_data.py --refresh-counts-only

Environment: reads ``backend/.env`` via ``config.settings`` (DB_*).
"""

from __future__ import annotations

import argparse
import random
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, List, Sequence, Tuple

import pymysql

# python_engine/ root (parent of storage/)
_ENGINE_ROOT = Path(__file__).resolve().parent.parent
if str(_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ENGINE_ROOT))

from config.settings import settings  # noqa: E402

# ``password`` — generated once with PHP: password_hash('password', PASSWORD_BCRYPT, ['cost' => 10])
_DUMMY_BCRYPT_PASSWORD = "$2y$10$Zu0k8J7WH6fth8VTJUnMguSJTyLG4R3C2JNZJA5AZxhFYRgagMCnO"

_ROLES: Tuple[str, ...] = ("admin", "staff", "paid", "unpaid")
_ROLE_WEIGHTS: Tuple[int, ...] = (1, 4, 15, 80)


def _connect():
    cfg = settings.DB_CONFIG.copy()
    return pymysql.connect(**cfg)


def _column_exists(cur: pymysql.cursors.Cursor, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT COUNT(*) AS c
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        (table, column),
    )
    row = cur.fetchone()
    return bool(row and row.get("c", 0) > 0)


def ensure_in_watchlist_column(conn: pymysql.Connection) -> None:
    """Demo-only: add denormalized watchlist member count; works with or without Laravel migrations."""
    with conn.cursor() as cur:
        if _column_exists(cur, "instrument_snapshot", "in_watchlist"):
            return
    with conn.cursor() as cur:
        try:
            cur.execute(
                "ALTER TABLE instrument_snapshot ADD COLUMN in_watchlist BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER change_pct"
            )
        except pymysql.err.OperationalError:
            cur.execute(
                "ALTER TABLE instrument_snapshot ADD COLUMN in_watchlist BIGINT UNSIGNED NOT NULL DEFAULT 0"
            )
    conn.commit()
    print("Added column instrument_snapshot.in_watchlist (demo; linked to watchlist → users)")


def fetch_symbols(cur: pymysql.cursors.Cursor) -> List[str]:
    cur.execute("SELECT DISTINCT symbol FROM instrument_snapshot ORDER BY symbol")
    rows = cur.fetchall() or []
    return [str(r["symbol"]) for r in rows if r.get("symbol")]


def clean_simulation_users(conn: pymysql.Connection, prefix: str) -> None:
    # Usernames are ``{prefix}_0000000`` — avoid SQL LIKE ``_`` wildcard via REGEXP.
    reg = f"^{re.escape(prefix)}_[0-9]+$"
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE w FROM watchlist w
            INNER JOIN users u ON u.id = w.user_id
            WHERE u.username REGEXP %s
            """,
            (reg,),
        )
        cur.execute("DELETE FROM users WHERE username REGEXP %s", (reg,))
    conn.commit()
    print(f"Removed prior simulation users/watchlist (username REGEXP '^{prefix}_[0-9]+')")


def refresh_in_watchlist_counts(conn: pymysql.Connection) -> None:
    with conn.cursor() as cur:
        if not _column_exists(cur, "instrument_snapshot", "in_watchlist"):
            print("Skip refresh: instrument_snapshot.in_watchlist missing (re-run without --skip-ensure-column)")
            return
        cur.execute("UPDATE instrument_snapshot SET in_watchlist = 0")
        cur.execute(
            """
            UPDATE instrument_snapshot s
            INNER JOIN (
                SELECT symbol, COUNT(*) AS c
                FROM watchlist
                GROUP BY symbol
            ) t ON t.symbol = s.symbol
            SET s.in_watchlist = t.c
            """
        )
    conn.commit()
    print("Refreshed instrument_snapshot.in_watchlist from watchlist counts")


def _batch_insert_users(
    cur: pymysql.cursors.Cursor,
    rows: List[Tuple[Any, ...]],
) -> None:
    cur.executemany(
        """
        INSERT INTO users (
            id, username, password, name, email, phone, role,
            email_verified_at, remember_token, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, NULL, %s,
            %s, NULL, %s, %s
        )
        """,
        rows,
    )


def _batch_insert_watchlist(cur: pymysql.cursors.Cursor, rows: List[Tuple[Any, ...]]) -> None:
    cur.executemany(
        """
        INSERT INTO watchlist (id, user_id, symbol, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s)
        """,
        rows,
    )


def run_feed(
    *,
    users_total: int,
    batch_size: int,
    min_symbols: int,
    max_symbols: int,
    prefix: str,
    clean_first: bool,
    ensure_column: bool,
    refresh_counts_only: bool,
    seed: int | None,
) -> None:
    if seed is not None:
        random.seed(seed)

    if min_symbols > max_symbols:
        raise SystemExit("--min-symbols cannot exceed --max-symbols")

    conn = _connect()
    try:
        if ensure_column:
            ensure_in_watchlist_column(conn)

        if refresh_counts_only:
            refresh_in_watchlist_counts(conn)
            return

        if clean_first:
            clean_simulation_users(conn, prefix)

        symbols: Sequence[str]
        with conn.cursor() as cur:
            symbols = fetch_symbols(cur)
        if not symbols:
            raise SystemExit("No symbols in instrument_snapshot — load snapshots first.")

        sym_list = list(symbols)
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        roles = _ROLES
        weights = _ROLE_WEIGHTS
        idx_width = max(7, len(str(users_total - 1)))

        print(f"Inserting {users_total} users (batch {batch_size}), watchlist {min_symbols}–{max_symbols} symbols each…")

        for start in range(0, users_total, batch_size):
            end = min(start + batch_size, users_total)
            user_batch: List[Tuple[Any, ...]] = []
            wl_batch: List[Tuple[Any, ...]] = []
            for i in range(start, end):
                uid = str(uuid.uuid4())
                idx = f"{i:0{idx_width}d}"
                uname = f"{prefix}_{idx}"
                email = f"{prefix}_{idx}@sim.feed.local"
                name = f"Sim {prefix.title()} {i}"
                role = random.choices(roles, weights=weights, k=1)[0]
                user_batch.append(
                    (uid, uname, _DUMMY_BCRYPT_PASSWORD, name, email, role, now, now, now)
                )
                k = random.randint(min_symbols, min(max_symbols, len(sym_list)))
                if k > 0:
                    for sym in random.sample(sym_list, k):
                        wl_batch.append(
                            (str(uuid.uuid4()), uid, sym, now, now)
                        )

            with conn.cursor() as cur:
                _batch_insert_users(cur, user_batch)
                if wl_batch:
                    for w in range(0, len(wl_batch), batch_size):
                        _batch_insert_watchlist(cur, wl_batch[w : w + batch_size])
            conn.commit()
            print(f"  committed users [{start}, {end})")

        refresh_in_watchlist_counts(conn)
    finally:
        conn.close()


def main() -> None:
    p = argparse.ArgumentParser(
        description="Demo: users + watchlist → instrument_snapshot.in_watchlist (Python ALTER; no migration)."
    )
    p.add_argument("--users", type=int, default=1_000_000, help="Number of users to insert")
    p.add_argument("--batch-size", type=int, default=4_000, help="Rows per INSERT batch")
    p.add_argument("--min-symbols", type=int, default=1, help="Min watchlist symbols per user")
    p.add_argument("--max-symbols", type=int, default=8, help="Max watchlist symbols per user")
    p.add_argument(
        "--username-prefix",
        default="simfeed",
        help="Usernames {prefix}_0000000; also used by --clean",
    )
    p.add_argument(
        "--clean",
        action="store_true",
        help="Before insert: delete users/watchlist for this prefix (username REGEXP '^{prefix}_[0-9]+')",
    )
    p.add_argument(
        "--skip-ensure-column",
        action="store_true",
        help="Do not ALTER TABLE to add instrument_snapshot.in_watchlist",
    )
    p.add_argument(
        "--refresh-counts-only",
        action="store_true",
        help="Only recompute in_watchlist from existing watchlist (no user inserts)",
    )
    p.add_argument("--seed", type=int, default=None, help="RNG seed for reproducible watchlists")
    p.add_argument(
        "--confirm",
        action="store_true",
        help="Required for --users > 10_000 (safety)",
    )
    args = p.parse_args()

    if args.refresh_counts_only:
        run_feed(
            users_total=0,
            batch_size=100,
            min_symbols=0,
            max_symbols=0,
            prefix="simfeed",
            clean_first=False,
            ensure_column=not args.skip_ensure_column,
            refresh_counts_only=True,
            seed=args.seed,
        )
        return

    if args.users > 10_000 and not args.confirm:
        raise SystemExit("Refusing large run without --confirm (add --confirm when ready).")

    if args.users < 1:
        raise SystemExit("--users must be >= 1")

    run_feed(
        users_total=args.users,
        batch_size=max(100, args.batch_size),
        min_symbols=max(0, args.min_symbols),
        max_symbols=max(0, args.max_symbols),
        prefix=args.username_prefix.strip() or "simfeed",
        clean_first=args.clean,
        ensure_column=not args.skip_ensure_column,
        refresh_counts_only=False,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
