# DSA — Implementation Plan
Updated: 2026-11-18
Source of tickets: [audit.md](audit.md). End-state: [roadmap.md](roadmap.md).
**State: IN PROGRESS on isolated work branches — no production deployment or production-branch mutation authorized.**

## Rules
- **No blind deployment:** GitHub `main` is at 2026-02-05 while the live aitemple.tech surface is newer. Locate the canonical live source on Raspberry Pi and reconcile it with Git history before editing production code.
- Preserve exact valid formulas, ranking/indicator models, datasets, historical semantics and citation/provenance. Missing data must not be converted to zero or bearish signal.
- No placeholder market data, fake realtime badges, hidden source errors, undocumented scoring changes.
- Branch per phase; targeted PR and reproducible tests; no unnecessary Vercel deployments or direct host overwrite.
- Measure baseline before optimization; favor reuse of existing architecture and components; no unnecessary UI library migration.

## Work packages and dependency order

### Phase 0 — Source parity & baseline (P0, mandatory before everything)
- [ ] P0.1 Inventory deployments: domain routing, Raspberry Pi service names, built assets, backend/frontend directories, release process, DB schema, remote branches.
- [ ] P0.2 Extract live deployed commit/build hashes; compare main `29a14d7`, verify route manifest and code ownership. Record exact live baseline with safe snapshot; do not guess parity.
- [ ] P0.3 Determine canonical repo / branch; if live code is not committed, import under controlled branch only after checking secrets and binary data. Write repeatable staging and rollback runbook.
- [ ] P0.4 Inventory every live route and take desktop/tablet/mobile screenshots, collect console/network errors, Lighthouse/accessibility and performance baseline.
- [ ] P0.5 Audit runtime demo data, especially `frontend/src/app/(site)/market-overview/page.tsx`; confirm whether file exists in live build.
- [~] P0.6 Align declared PHP runtime with dependency lock. Repository baseline candidate is updated to PHP 8.4; deployed Raspberry Pi PHP version still requires verification.
**Exit:** verified mapping of live route → actual source and deployment, clean baseline, backups, reproducible QA. **BLOCK** later code changes until achieved.

### Phase 1 — Trust and data correctness (P0)
- [x] T1 Trace ranking/conviction path and gate incomplete/synthetic inputs; incomplete rows now present as Not Rated instead of directional conviction.
- [x] T2 Add explicit eligibility/data-state metadata through Python/Laravel/frontend ranking paths; remaining stale/delayed taxonomy work continues under C1/C2.
- [x] T3 Fail closed against demo-table/demo-symbol mode in production defaults. Independent live production verification is still required before release.
- [~] T4 Regression guards added for production table selection. Golden market-data fixtures for sparse history, stale quotes, holidays and recovery are still required.
- [~] T5 Fix historical coverage parity for the 40-symbol Market View universe: remove 15-symbol persistence whitelist, keep UUID IDs intact, rotate scheduled backfill order, tolerate sparse Yahoo candles, expose history coverage metadata, and add `data:coverage`. CI/live Pi coverage verification remains before release.
**Exit:** no invalid Buy/Sell states, zero-as-missing, or misleading live status. Compare legitimate scoring outputs unchanged.

### Phase 2 — Data provenance and content integrity (P1)
- [ ] C1 Review BUG-004/008/009. Data Health: stored coverage vs completeness vs freshness vs source health vs analytic eligibility; show denominators/calendars.
- [ ] C2 Show per-metric source, observed-at, fetched-at, delay, timeframe, venue, entitlement and version where relevant.
- [~] C3 Placeholder/stale document cards and fake Preview/Download controls removed; retained on-site references now resolve to real document sections. Full live-route crawl remains required.
- [~] C4 Screener now separates partial fundamentals from hard errors; News removes unverified realtime claims and invalid-date freshness. Analytics/Events/Options still require verified live source.
- [ ] C5 Rebuild accurate README/methodology/install/deploy docs, including source licensing boundaries.
**Exit:** data lineage and age visible and truthful; all published documents checked, no indefinite loading.

### Terminology gate — before UI polish
- [x] Replace user-facing Buy/Hold/Sell conviction labels on Rankings/Market View with Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish / Not Rated.
- [x] Keep internal enum compatibility where required; presentation layer maps to research terminology.
- [x] Remove advisory language such as overweight/accumulate/trim from composite signal tooltips.
- [ ] Audit remaining public pages for raw BUY/SELL/HOLD strings and convert presentation only.

### Phase 3 — UI foundation (P1)
- [~] D1 Shared design tokens are implemented in the repository baseline candidate; **live-source parity is still unverified**, so this cannot be marked complete.
- [~] D2 Shared shell/control/panel/button/navigation classes added. Symbol header, chart frame, status/tooltip/empty-state primitives remain.
- [~] D3 Global header/search/navigation compacted and active-state styling standardized; saved views/context persistence remain.
- [~] D4 Screener numeric density/alignment and research hierarchy implemented; broader tables/charts still need migration.
- [ ] D5 Review terms/locales; choose a single primary UI language plus explicit translation support.
- [ ] D6 Test responsiveness and accessibility at 390, 768, 1024 and 1440 pixels; snapshot visual regressions.
**Exit:** visually coherent shell and components without changing backend calculations.

### Phase 4 — Module-by-module refinement (P1→P2)
- [~] M1 Home/Market View converted from marketing hero to compact research header; sticky toolbar now respects global header. Source-freshness strip remains.
- [~] M2 Ranking eligibility is gated; Screener now has sticky dense numeric table and partial-data warning. Heatmap/filter work remains.
- [~] M3 Indicators tab shell now respects global header; chart interaction consistency still pending.
- [!] M4 BLOCKED: Data Health / Market Analytics live routes are not present in the selected GitHub baseline candidate; source parity must be resolved before editing them.
- [~] M5 News and Documents received trust/UI cleanup; Events source is not yet verified in this baseline.
- [~] M6 Instrument detail/history: persisted-history coverage is explicit; fake local community sentiment and heuristic fallback radar removed; chart research-bias terminology aligned; profile watch state now uses the canonical server API and realtime status requires an actual quote. Remaining source/as-of provenance and responsive visual QA are pending.
**Exit:** each module has before/after captures, smoke/visual/functional tests; no console or blocking API errors.

### Phase 5 — Polish, performance, security and release (P2)
- [ ] R1 Accessibility and Core Web Vitals review, load-test primary pages, check chart/table CPU & memory.
- [ ] R2 Check CDN caching, SSR/CSR, route discovery/SEO, broken links, secure/error-safe client messaging.
- [ ] R3 Canary/staging release, compare API data + golden fixtures; confirm zero formula changes; manual approval for production.
- [ ] R4 Post-release monitoring and rollback; use metrics and issue evidence to close tickets.
**Exit:** stable, traceable release and no trust regression.

## Execution board
| Order | Deliverable | Priority | Dependencies | Status |
|---|---|---|---|---|
| 0 | Source parity audit + baseline | P0 | none | PARTIAL — Git baseline created; live Pi SHA still unknown |
| 1 | Signal eligibility and zero/missing isolation | P0 | 0 | IMPLEMENTED ON WORK BRANCH; TEST/RELEASE BLOCKED |
| 2 | Provenance and stale/source semantics | P1 | 0–1 | IN PROGRESS |
| 3 | Documentation and error/empty/loading | P1 | 0–2 | IN PROGRESS |
| 4 | UI tokens and shared layout components | P1 | 0; ideally 1–2 | IN PROGRESS |
| 5 | Rankings, tables and charts | P1 | 2–4 | IN PROGRESS |
| 6 | Secondary modules and responsive | P2 | 4–5 | NOT STARTED / PARTIAL PER ROUTE |
| 7 | Full QA, canary, rollback-ready release | P1 | 0–6 | BLOCKED |

## Per-ticket Definition of Done
Issue reproduced or conclusively classified; root-cause and code path documented; test added; numeric and data-provenance invariants pass; screenshot before/after if UI; responsive/keyboard checks; no unnecessary new polling or deployment; PR with rollback instructions; production outcome verified when released.

## Change log
- 2026-11-18: P1.2 company profile trust cleanup started: explicit persisted-history coverage, no seeded local community sentiment, no heuristic fallback radar, and chart model output labeled as research bias.
- 2026-11-18: Confirmed 40-symbol Market View history gap: board limit is 40 while `DataPeriods` persisted only 15 hard-coded tickers. Isolated P0 branch now aligns persistence to live snapshot universe, fixes UUID instrument IDs, removes synthetic/wiped sparklines, and adds `data:coverage` for Pi verification.
- 2026-11-18: PHP runtime mismatch confirmed: committed vendor/lock require >=8.4 while Dockerfile/composer constraint were 8.2-compatible; isolated branch aligned to PHP 8.4 pending Pi runtime verification.
- 2026-11-18: P1 UI foundation started on isolated child branch: neutral design tokens, compact global shell, Market View/Investing/Indicators/News/Documents/Screener cleanup, and CI workflow added. No deployment performed.
- 2026-11-18: Data Health / Market Analytics source gap reconfirmed in selected baseline candidate; do not recreate or overwrite those live modules until production source parity is established.
- 2026-11-18: plan created from public-site content audit plus confirmed dated repository inspection; intentionally no deployment performed.
