# DSA — Issue Register & Improvement Backlog
Updated: 2026-11-18 (Asia/Ho_Chi_Minh)
Scope: aitemple.tech public surfaces + GitHub `vinhvrs/Decision-System-Advisor` main at `29a14d737b8ba6ddecc6fc8549e0bb77e9580a05`.

## Evidence and severity
- **CONFIRMED-SOURCE:** directly seen in repository; **OBSERVED-WEB:** in public page content, not necessarily visually reproduced; **VERIFY:** hypothesis requiring browser/network/backend tests.
- **P0 Blocker:** wrong/misleading investment output, source/prod divergence, unsafe release.
- **P1 High:** broken core experience, inaccurate metadata, critical usability/trust loss.
- **P2 Medium:** consistency, navigation, responsive, accessibility, polish.
- **P3 Later:** optional enhancements after stable release.
- Every ticket needs owner, affected route/component, before/after evidence, test and rollback notes. No silent marking as fixed.

## Bugs and defects

| ID | Level | Status | Location | Observation / verification | Acceptance criteria |
|---|---|---|---|---|---|
| BUG-001 | P0 | OBSERVED-WEB | /investing rankings | Some rows with missing price (`—`) and `0.00%` appear as `Strong Sell`, strength `0/5` (e.g. AMD). Confirm score pipeline dependencies. | Incomplete inputs produce UNRATED / INSUFFICIENT_DATA unless a genuinely independently supported stance; no zero-as-missing substitutions. Preserve valid formulas. |
| BUG-002 | P0 | CONFIRMED-SOURCE | GitHub vs production | Repo main last commit 2026-02-05; current public website has /data-health, /market-analytics, chart-data-map not present in visible Next.js app tree. | Identify running code repository, deployed commit, services and deployment pipeline; hash/diff working production against GitHub; no code deployment before parity proven. |
| BUG-003 | P0 | CONFIRMED-SOURCE | frontend/src/app/(site)/market-overview/page.tsx | Static demo `Stock A/B/C/D`, fixed values rendered in page source. | Demo data cannot appear in production research surfaces; replace with validated real source or explicit nonfunctional example in a dev-only route. |
| BUG-004 | P1 | OBSERVED-WEB | /data-health, / | `40/40 stored`, `0 stale` coexists with `PARTIAL` and source error; can be misread as 100% trustworthy. | Independent indicators for storage coverage, feed health, input completeness, freshness, analytic eligibility; explain denominators and session calendars. |
| BUG-005 | P1 | OBSERVED-WEB | /market-analytics | Price and volatility history insufficient for charts, empty correlation cells; feature is navigable despite incomplete datasets. | Honest empty state with eligibility, reason, minimum required sample count and retry/alternative; never fabricated chart points. |
| BUG-006 | P1 | OBSERVED-WEB | /documents | Documents with legacy Q1 2024 title and relative `2 hours ago` metadata require audit of actual content/download. | All listed documents verified accessible, current or archived, correct authored/updated dates, true file type/size; remove placeholder items. |
| BUG-007 | P1 | VERIFY | /news, /events, /screener, /indicators | Initial page content includes `Preparing…` or `Loading…`; could be normal hydration, stuck state or poor SEO. | Browser loads to useful state or explicit error on desktop/mobile; network and hydration QA; retry, timeout, accessible loading. |
| BUG-008 | P1 | OBSERVED-WEB | /market-analytics, /data-health | `YFINANCE_DEV` fallback, missing entitlements, unconfigured feeds, historical freshness shown; users may assume realtime. | Source/entitlement/delay/provenance and bar-observed timestamp shown next to dependent values; no misleading LIVE/OK flags. |
| BUG-009 | P1 | VERIFY | Cross-route scores, rankings, charts | Consistency of instrument timestamps, quote vs candle changes, signal labels, score calculation and session clock not yet verified. | Same scope/timeframe and provenance yield consistent readings on every surface; mismatches flagged and tested. |
| BUG-010 | P1 | CONFIRMED-SOURCE | README.md, frontend app shell | README is generic Laravel boilerplate and app footer presents `Academic Project`; may not describe deployed system. | Accurate architecture/runbooks, source of truth, supported data and public positioning; no conflicting claims. |
| BUG-011 | P2 | OBSERVED-WEB | /market-analytics & site-wide | English navigation with Vietnamese chart empty states, mixed developer/internal terminology. | Unified locale policy, terminology dictionary and translated user-facing states; internal error IDs kept only for diagnostics. |
| BUG-012 | P2 | VERIFY | Charts/screener/data tables | Responsive overflow, clipped chart labels, tooltip/hovers, skeleton layout shifts, zoom/pan retention, mobile touch not yet tested. | Screenshot and interaction QA at 390/768/1024/1440px; no clipping, unintended resets, inaccessible controls. |
| BUG-013 | P2 | VERIFY | App runtime, crawlability | CSR-only page text, console/API errors, loading/hydration, LCP and route-to-route loading need measurement. | Automated accessibility/performance/route smoke results saved; critical content SSR/prerendered where appropriate. |
| BUG-014 | P2 | VERIFY | Documents/navigation/footer | Dead links, misleading navigational items, stale links and public downloads require systematic crawl. | No broken user-facing destinations in tested public routes. |
| BUG-015 | P0 | CONFIRMED-SOURCE | backend runtime / Composer | Dockerfile is PHP 8.2 and composer.json allowed ^8.2 while composer.lock/vendor platform check require PHP >=8.4. Fresh install fails on PHP 8.2/8.3. | Runtime, Dockerfile, composer constraint, lock file and deployed PHP version agree; clean composer install + tests pass on the declared version before release. |

## Improvement opportunities (not automatically defects)

| ID | Level | Influence | Change | Success / design rule |
|---|---|---|---|---|
| UX-001 | P0 | Fiscal.ai trust model | Establish data-state taxonomy: REAL_ZERO / MISSING / STALE / DELAYED / PARTIAL / ERROR / INELIGIBLE; map consistently to signal engine and widgets. | Every rendered value and recommendation has eligibility/source/timestamp and no default sell from absence. |
| UX-002 | P1 | Koyfin | Unified research shell: compact navigation, global symbol search, symbol context, workspace tabs, comparison and durable filters. | Users can reach key tools in ≤3 interactions; consistent context between routes. |
| UX-003 | P1 | Finviz | Dense, fast screeners: sortable/filterable tables, tabular numerals, right-aligned numbers, sticky headers, column settings and export where authorized. | Keyboard accessible, legible on desktop, graceful horizontal scroll on mobile. |
| UX-004 | P1 | Fiscal.ai | Trust strip per chart/score: source, observed-at, retrieval time, interval, licensing/delay, methodology and confidence/coverage. | Explainability available without opening developer diagnostics. |
| UX-005 | P1 | Koyfin + Fiscal.ai | Consistent chart components: axes, timezone, legends, missing-data handling, sources, crosshair, tooltips, zoom persistence. | Same interaction semantics in every workspace; no invented gap fill. |
| UX-006 | P1 | All three | Design tokens: subdued dark/light surfaces, reduced card borders/radii, typography scale, semantically consistent colors, spacing and density. | Single shared token layer; readable dense charts; no decorative color/gradient overload. |
| UX-007 | P1 | Finviz | Optimize Rankings/heatmap/watchlist, clear difference between score, stance, strength, signal and momentum. | Scanning clarity and no false trading instructions. |
| UX-008 | P2 | Koyfin | Information architecture: resolve overlap among Terminal, Market View, Rankings, Market Metrics, Indicators, Analytics. | No duplicate destination names, clean breadcrumbs and active state. |
| UX-009 | P2 | Fiscal.ai | Documentation methodology pages with coverage, sample requirements, attribution and updated dates. | Verifiable, publicly meaningful research provenance. |
| UX-010 | P2 | All three | Intentional states: skeleton / no coverage / insufficient sample / source unavailable / rate limited / permission blocked. | Useful next action, no indefinite loading; no leaking internal infrastructure details. |
| UX-011 | P2 | All three | Accessible responsive keyboard/touch support, color-blind-safe states, focus, contrast and reduced-motion. | WCAG 2.2 AA target for main journeys and tested breakpoints. |
| UX-012 | P2 | Koyfin | Personal saved views, compare layouts and context preservation (later only if backend supports it). | No state loss when switching workspace. |
| UX-013 | P3 | Finviz | Advanced heatmaps, screener presets and compact institutional-style dashboards. | Feature-gated until feed coverage sufficient. |
| UX-014 | P3 | Fiscal.ai | Polished research notes, explainable AI summaries with source citations. | Never auto-assert unsupported predictions. |

## P0 follow-up discovered during P1.3
- **BUG-001 cross-route bypass:** `WatchlistDashboardTable` independently recomputed conviction from radar/Str, ignored `analysis_eligible`, and still rendered Strong Buy/Buy/Hold/Sell/Strong Sell. Fixed on `work/p1-3-secondary-ui-20261118`: ineligible rows now show **Not Rated**, Str is withheld, placeholder zero price/liquidity is not displayed as real data, and the canonical Bullish/Bearish terminology is used.
- This confirms the release gate must search all presentation surfaces for local scoring/stance reimplementations before BUG-001 can be considered fully closed.

## Profile trust follow-up
- **P1 confirmed:** company profile watchlist controls were local-only `sessionStorage` flags and did not mutate the backend watchlist used by Watchlist Dashboard. Fixed on P1.5 by routing all profile controls through `useWatchlist()`.
- **P2 confirmed:** Markets displayed static `ALL / Primary` chips that looked interactive but were not controls. Removed. Derived metrics are now labeled as **Last-bar $ volume** and **Bar volume / market cap** rather than ambiguous venue-volume terms.

## Research terminology standard
- User-facing directional labels: **Strong Bullish / Bullish / Neutral / Bearish / Strong Bearish / Not Rated**.
- Internal compatibility enums such as `BUY/SELL/HOLD` or `buy/sell/flat` may remain in APIs/storage when required, but should not be shown raw to end users.
- Directional labels describe research/model bias, not an instruction to trade.
- Missing/ineligible data must display **Not Rated**, never Bearish/Strong Bearish by default.

## Cross-cutting gates
1. SOURCE GATE: establish GitHub/main-to-live parity, Raspberry Pi host checkout, deployed hash, backups and authoritative deploy pipeline.
2. DATA GATE: preserve calculations, periods, datasets and licensing rules; golden dataset compare before/after at exact numeric precision where possible.
3. RELEASE GATE: isolated branch/PR, CI checks, screenshots, compare paths, independent QA, explicit approval before deploy; rollback documented.
4. PERFORMANCE GATE: baseline and re-test load time, API count, chart interactions and memory; do not add polling or heavy rendering simply for aesthetics.
5. ACCOUNTABILITY: classify evidence, P-level and affected source file after parity; update status only with proof.

## Public evidence
- https://aitemple.tech/investing
- https://aitemple.tech/market-analytics
- https://aitemple.tech/data-health
- https://aitemple.tech/documents
- https://aitemple.tech/indicators
- https://aitemple.tech/
- GitHub main: https://github.com/vinhvrs/Decision-System-Advisor/tree/main

**Caution:** Website text/crawl is NOT a complete visual browser audit; observed symptoms do not establish root cause. Most current live paths are not mapped to this dated GitHub checkout yet.
