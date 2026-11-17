# DSA — Implementation Plan
Updated: 2026-11-18
Source of tickets: [audit.md](audit.md). End-state: [roadmap.md](roadmap.md).
**State: PLANNED — documentation only; no production changes authorized by this commit.**

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
**Exit:** verified mapping of live route → actual source and deployment, clean baseline, backups, reproducible QA. **BLOCK** later code changes until achieved.

### Phase 1 — Trust and data correctness (P0)
- [ ] T1 Verify BUG-001: trace all rankings and score gates; make explicit availability/eligibility state, do not show Strong Sell simply because input is missing.
- [ ] T2 Implement shared semantics from UX-001 (missing vs true zero vs stale vs partial); consistent JSON contract, backend/frontend mapping.
- [ ] T3 Prevent use of dev/demo numbers in public trading surfaces, and independently verify score/timeframe/price-change consistency.
- [ ] T4 Add golden fixture tests: missing inputs, zero, sparse histories, quote-vs-close, holiday/weekend, last-bar aging, multiple source failure and recovery.
**Exit:** no invalid Buy/Sell states, zero-as-missing, or misleading live status. Compare legitimate scoring outputs unchanged.

### Phase 2 — Data provenance and content integrity (P1)
- [ ] C1 Review BUG-004/008/009. Data Health: stored coverage vs completeness vs freshness vs source health vs analytic eligibility; show denominators/calendars.
- [ ] C2 Show per-metric source, observed-at, fetched-at, delay, timeframe, venue, entitlement and version where relevant.
- [ ] C3 Validate all Documents titles, file URLs, contents, sizes, published/updated times; remove/label obsolete/demo documents.
- [ ] C4 Fix shared loading/error/empty states: Analytics history, News, Events, Screener, Options; distinguish missing feed from broken API.
- [ ] C5 Rebuild accurate README/methodology/install/deploy docs, including source licensing boundaries.
**Exit:** data lineage and age visible and truthful; all published documents checked, no indefinite loading.

### Phase 3 — UI foundation (P1)
- [ ] D1 Audit existing CSS/components/route shells in **verified live source**, define design tokens (typography, spacing, color, border, radius, elevation, density and responsive).
- [ ] D2 Create component system: page header, symbol header, toolbar, card/section, table, chart frame, status, tooltip, empty state, modal.
- [ ] D3 Koyfin-inspired layout: fixed predictable navigation, context-rich global search, clear active route, saved filters where already supported.
- [ ] D4 Finviz-inspired data density: numeric columns and comparison tables; Fiscal.ai-inspired provenance and explanation hierarchy.
- [ ] D5 Review terms/locales; choose a single primary UI language plus explicit translation support.
- [ ] D6 Test responsiveness and accessibility at 390, 768, 1024 and 1440 pixels; snapshot visual regressions.
**Exit:** visually coherent shell and components without changing backend calculations.

### Phase 4 — Module-by-module refinement (P1→P2)
- [ ] M1 Terminal/home: market overview and source freshness; loading/empty/responsive.
- [ ] M2 Rankings and Screener: score eligibility, sticky sortable columns, table density, filter clarity, heatmap.
- [ ] M3 Analytics/Indicators: chart interaction consistency, missing history, legends, scales, tooltips, zoom and timeframe persistence.
- [ ] M4 Macro/Data Health: category hierarchy, contextual recency and safe absence semantics.
- [ ] M5 News, Events and Documents: meaningful content, chronology and verified destinations.
- [ ] M6 Instrument detail/history: research context, disclaimers, source provenance, functional chart interactions.
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
| 0 | Source parity audit + baseline | P0 | none | NOT STARTED |
| 1 | Signal eligibility and zero/missing isolation | P0 | 0 | BLOCKED |
| 2 | Provenance and stale/source semantics | P1 | 0–1 | BLOCKED |
| 3 | Documentation and error/empty/loading | P1 | 0–2 | BLOCKED |
| 4 | UI tokens and shared layout components | P1 | 0; ideally 1–2 | BLOCKED |
| 5 | Rankings, tables and charts | P1 | 2–4 | BLOCKED |
| 6 | Secondary modules and responsive | P2 | 4–5 | BLOCKED |
| 7 | Full QA, canary, rollback-ready release | P1 | 0–6 | BLOCKED |

## Per-ticket Definition of Done
Issue reproduced or conclusively classified; root-cause and code path documented; test added; numeric and data-provenance invariants pass; screenshot before/after if UI; responsive/keyboard checks; no unnecessary new polling or deployment; PR with rollback instructions; production outcome verified when released.

## Change log
- 2026-11-18: plan created from public-site content audit plus confirmed dated repository inspection; intentionally no code or deployment performed.
