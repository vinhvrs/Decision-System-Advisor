# Market View History Coverage — Pi Verification & Recovery

Updated: 2026-11-18

## Purpose

Use this runbook only after the P0 history-persistence branch is present in the Raspberry Pi checkout. It verifies that every symbol intended for the 40-row Market View has **real persisted daily OHLC**, not merely a realtime quote.

The canonical scheduled OHLC writer is the Python **DSATurbo** pipeline. Laravel `data:periods` is retained only for legacy/manual diagnostics and must **not** be used for normal recovery because it has different Yahoo adjustment/timestamp semantics.

This procedure does not change ranking formulas and never manufactures missing candles.

## Safety rules

- Record the deployed Git SHA and working-tree state before any action.
- Do not rebuild MySQL, Redis, Elasticsearch or Qdrant to repair missing OHLC.
- Do not delete history/snapshot rows automatically.
- Do not treat a realtime quote as historical coverage.
- Audit first; backfill only the missing/short symbols when possible.
- If duplicate trading-date rows exist, inspect their source/timestamp/adjustment semantics before cleanup.
- Keep the currently serving checkpoint available for rollback.

## 1. Record the live checkpoint

From the DSA checkout:

```bash
git rev-parse HEAD
git status --short
docker compose ps
```

If the working tree contains uncommitted production changes, capture them before switching branches or rebuilding containers.

## 2. Confirm the audit command and runtime universe

```bash
docker compose exec app php artisan list --raw | grep '^data:'
docker compose config | grep -E 'SYMBOL_INGEST_(MODE|TOP_N)'
```

Expected commands include:

```text
data:coverage
data:periods
```

Expected scheduled production universe:

```text
SYMBOL_INGEST_MODE=top_snapshot
SYMBOL_INGEST_TOP_N=40
```

If `TOP_N` is still 20, stop. The runtime is not using this P0 configuration.

## 3. Audit the intended 40-symbol board

```bash
docker compose exec app php artisan data:coverage --limit=40 --min-bars=40
```

The command reports, per symbol:

- symbol
- current snapshot price and snapshot age
- persisted daily-row count
- distinct daily-date count
- duplicate rows on the same trading date
- first persisted bar
- last persisted bar
- `OK`, `SHORT` or `MISSING`

Release target:

```text
40/40 OK
SHORT=0
MISSING=0
DUP_ROWS=0
```

A symbol can have a current realtime price while still being `SHORT` or `MISSING`. That is not complete history coverage.

## 4. Backfill through the canonical Python collector

### Targeted missing symbols

Example:

```bash
docker compose run --rm data-engine \
  python3 -m app.data_collect.collectors.stock_sync \
  --days 3650 \
  --symbols AMD,ADBE,CRM
```

Replace the symbols with the actual `SHORT`/`MISSING` set from Step 3.

### Refill the intended board pool

If many board symbols are incomplete:

```bash
docker compose run --rm data-engine \
  python3 -m app.data_collect.collectors.stock_sync \
  --days 3650 \
  --limit 40
```

DSATurbo writes the production `instrument_data` table and its daily/weekly/monthly/yearly periods using the same semantics as the scheduled Python stock job.

**Do not use `php artisan data:periods` for this recovery.** It is intentionally not scheduled now because its legacy raw-Yahoo/timestamp convention differs from DSATurbo and can create duplicate trading-date bars when mixed.

## 5. Refresh ranking/snapshot and Redis after manual backfill

A scheduled stock cycle performs these follow-up steps automatically. After a manual one-off DSATurbo backfill, run the existing ranking sync and dashboard warm-up explicitly:

```bash
docker compose exec data-engine \
  python3 -c 'from app.jobs.ranking_job import run_ranking_sync; run_ranking_sync()'

docker compose exec data-engine \
  python3 -m app.warm_up.warm_up --limit 40 --chart-bars 90
```

This rebuilds `instrument_snapshot`/ranking from persisted OHLC and then republishes `dashboard:daily`. Do not edit snapshot rows by hand.

Then re-run:

```bash
docker compose exec app php artisan data:coverage --limit=40 --min-bars=40
```

Expected exit status: `0`.

## 6. If duplicate daily rows are reported

Do **not** delete by date automatically.

First inspect the duplicate rows for a sample symbol and compare:

- `source`
- exact `timestamps`
- OHLC values
- whether prices are adjusted/unadjusted
- which collector created each row

Known historical risk: legacy Laravel Yahoo rows used a different timestamp convention from DSATurbo/yfinance. Cleanup requires choosing the canonical DSATurbo representation and verifying numeric consequences before deleting anything.

## 7. Verify Redis/dashboard coverage metadata

The dashboard publisher measures persisted history **before** appending the current realtime snapshot price.

Target `dashboard:daily` meta:

- `history_missing_count = 0`
- `history_short_count = 0`
- `history_ok_count = 40` for the intended board

Per row:

- `history_state = "ok"`
- `history_points >= 2` (and operationally the server audit requires at least 40 daily bars)

Realtime quote availability is independent of this status.

## 8. Browser verification

Check several symbols from the start, middle and end of the 40-row board, especially:

`AMD, ADBE, CRM, CSCO, ASML, INTU, QCOM, NOW, PANW, SNOW`

For each sample:

1. Confirm Trend is a genuine multi-point historical series.
2. Observe a period with no new quote ticks; the chart must remain visible.
3. Trigger/observe a dashboard Redis refresh; live price/change/bias must not jump back to the stale snapshot.
4. Reconnect/reload the websocket or page; stored history must remain.
5. An intentionally missing-history symbol must show **No history**, never a fabricated flat/two-point line.

## 9. Scheduler verification

The canonical candle sync runs in `data-engine` through Python APScheduler / `stock_job`.

Confirm scheduler health and container configuration show:

- stock sync active at the deployment cadence;
- `SYMBOL_INGEST_TOP_N=40`;
- `data:periods` is **not** present as a scheduled Laravel OHLC task.

Realtime quotes remain on the separate websocket/Yahoo ticker path.

## 10. Rollback / stop-release criteria

Stop promotion if any of the following remains:

- coverage is not 40/40 OK for the intended universe;
- duplicate trading-date rows are unresolved;
- UUID instrument IDs are not preserved;
- history disappears when realtime price stops moving;
- transient history API failure clears previously valid chart data;
- synthetic/two-point historical series reappear;
- production board is filtered or completed from dev seed symbols;
- realtime subscription depends on a missing universe module;
- valid ranking/numeric outputs change as a side effect.

## Root cause captured by this fix

The issue was not one single chart bug. Several mismatched universes and fallback paths accumulated:

1. UI board limit = 40.
2. Scheduled Python OHLC sync default/runtime = 20.
3. Legacy PHP OHLC persistence had a separate hard-coded 15-symbol list.
4. Realtime explicitly allowed 10 symbols documented as lacking historical rows.
5. Production Redis normalization could inject/filter dev-seed rows.
6. UI fabricated a short line when history did not exist.

The P0 repair separates **quote coverage** from **persisted history coverage**, aligns the runtime board/history universe to 40, removes production demo leakage, and makes DSATurbo the single scheduled OHLC writer.
