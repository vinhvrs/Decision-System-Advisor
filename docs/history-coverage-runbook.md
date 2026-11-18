# Market View History Coverage — Pi Verification & Recovery

Updated: 2026-11-18

## Purpose

Use this runbook after the P0 history-persistence changes are present on the Raspberry Pi checkout. It verifies that the visible Market View universe has real persisted OHLC history rather than realtime-only quotes.

This procedure does **not** change ranking formulas or manufacture missing candles.

## Safety rules

- Record the deployed Git SHA before any action.
- Do not rebuild the database, Redis, Elasticsearch or Qdrant to repair missing OHLC.
- Do not delete snapshot/history tables.
- Do not treat a realtime quote as historical coverage.
- Audit first; backfill only the missing/short symbols when possible.
- Keep the currently serving production checkpoint available for rollback.

## 1. Record the live checkpoint

From the DSA checkout:

```bash
git rev-parse HEAD
git status --short
docker compose ps
```

If the working tree contains uncommitted production changes, capture them before switching branches or rebuilding containers.

## 2. Confirm the commands exist

```bash
docker compose exec app php artisan list --raw | grep '^data:'
```

Expected commands include:

```text
data:coverage
data:periods
```

If they are absent, the P0 history branch is not active in the backend container yet. Stop here instead of attempting a manual database repair.

## 3. Audit the visible 40-symbol universe

```bash
docker compose exec app php artisan data:coverage --limit=40
```

The command reports, per symbol:

- symbol
- UUID instrument ID
- persisted daily-bar count
- first persisted bar
- last persisted bar
- snapshot updated time
- coverage status

Coverage states:

- `OK`: at least 2 persisted daily bars
- `SHORT`: exactly 1 persisted daily bar
- `MISSING`: 0 persisted daily bars

For Market View trend rendering, the release target is:

```text
short=0
missing=0
```

## 4. Backfill only what is missing

If only a few symbols are missing, use a targeted run:

```bash
docker compose exec app php artisan data:periods --symbols=AMD,ADBE,CRM
```

Replace the example symbols with the actual `SHORT`/`MISSING` symbols from Step 3.

If the current 40-symbol universe broadly lacks history:

```bash
docker compose exec app php artisan data:periods --limit=40
```

The job now:

- follows the live snapshot universe instead of the old 15-symbol whitelist;
- keeps UUID instrument IDs intact;
- rotates scheduled symbol order so the same tail symbols are not starved by upstream throttling;
- retries Yahoo requests;
- skips isolated malformed historical rows instead of aborting the whole symbol;
- rebuilds weekly/monthly/yearly aggregates from persisted daily history.

## 5. Enforce the coverage gate

After backfill:

```bash
docker compose exec app php artisan data:coverage --limit=40 --fail-missing
```

Expected exit status: `0`.

Do not promote the build if this command fails for symbols intended to appear in Market View.

## 6. Verify Redis/dashboard payload

The dashboard publisher now distinguishes persisted history from the appended realtime price.

Verify the generated `dashboard:daily` payload/meta reports:

- `history_missing_count = 0`
- `history_short_count = 0`
- `history_ok_count` equal to the intended board universe

Per row:

- `history_state = ok`
- `history_points >= 2`

A symbol may have a current price even when history is missing. That is not considered complete coverage.

## 7. Browser verification

For at least one symbol near the beginning and several symbols near the end of the 40-symbol universe:

1. Open Market View.
2. Confirm Trend shows a multi-point historical series.
3. Stop interacting and observe a period with no new quote ticks.
4. Confirm the trend/history remains visible.
5. Reconnect/reload the realtime socket or refresh the page.
6. Confirm historical series remains present.
7. Confirm the Market View provenance strip reports persisted-history coverage separately from realtime-quote coverage.
8. Confirm an intentionally missing-history symbol shows `No history` rather than a fabricated flat line.

## 8. Scheduler verification

Check the Laravel scheduler process is active using the deployment's existing process-management method.

The history job is intentionally **not** a realtime quote loop. Its cadence is every 15 minutes:

```text
data:periods -> everyFifteenMinutes
```

Realtime quotes continue through the separate websocket/quote pipeline.

Do not restore the old 15-second Yahoo history cadence; it can amplify upstream throttling and repeatedly starve later symbols.

## 9. Rollback criteria

Rollback or stop release promotion if any of the following occurs:

- `data:coverage --fail-missing` fails for the intended universe after a clean targeted backfill;
- UUID instrument IDs are not preserved;
- historical bars disappear when realtime price stops moving;
- a history API failure clears previously valid chart data;
- Market View recreates a two-point/flat synthetic history;
- the backend begins polling Yahoo history at realtime cadence;
- valid ranking or numeric outputs change as a side effect of the history repair.

## Root cause captured by this fix

The production Market View is configured for 40 rows, while the previous `data:periods` command persisted a hard-coded list of only 15 symbols. Realtime quotes and persisted OHLC are separate pipelines, so later symbols could show moving prices without stored chart history. UI fallback behavior then made the issue look like a flat line or disappearing chart.

The repair makes historical persistence follow the live universe and makes missing history explicit rather than synthetic.
