# DSA — Product Roadmap & Target Experience
Updated: 2026-11-18
**North star:** DSA is a fast, professional **financial research terminal** inspired by Koyfin's information architecture, Finviz's scanning density and Fiscal.ai's analytical transparency — not a visual clone and not a promise of regulated realtime data.

## End-state requirements
1. **Trust first:** every important number and Buy/Sell/Not Rated conclusion is traceable to calculation, complete input, source and observation time; missing inputs never masquerade as zero, negative momentum or bearish consensus.
2. **Professional visual language:** neutral dense layouts, clear hierarchy, restrained borders/shadows, consistent spacing/type/iconography and semantic status colors. Chart and table readability outranks decoration.
3. **Efficient research flow:** symbol discovery → summary → comparison/ranking/screener → indicators/charts → macro/context → methodology/data health, without losing symbol/timeframe/filter context.
4. **Source honesty:** display data eligibility, market/session calendar, delay, refresh age, fallback and source failures. Do not call delayed/dev data realtime.
5. **Resilience:** every route renders a useful state; errors are recoverable, no indefinite skeletons, broken download, misleading document metadata or silent data substitution.
6. **Fast interactions:** navigation, filtering, chart pan/zoom and sortable tables remain responsive on typical desktops and usable on touch devices. Performance budgets set from a measured baseline, not guesses.
7. **Accessibility and clarity:** WCAG 2.2 AA aspiration for main journeys; keyboard navigation, readable contrast, responsive 390/768/1024/1440, standardized terminology and locale strategy.
8. **Maintainable engineering:** canonical source mapped to production, guarded deploys, clear ownership, shared design system, snapshot/golden-data tests, rollback and monitoring.

## Inspirations translated into DSA decisions
| Reference | Adopt | Avoid |
|---|---|---|
| Koyfin | Multi-workspace navigation, comparison and symbol context, dense but organized screens | Excessive panels, complex controls without actual user demand |
| Finviz | Scan-friendly tables and heatmaps, clear conditional formatting, efficient filters | Color noise, fake market breadth, overcompression on mobile |
| Fiscal.ai | Source provenance, methodology, measured score confidence, professional research tone | Opaque AI conclusions, marketing claims unsupported by coverage |

## Target architecture / UI
- Shared app shell: navigation/sidebar or compact top navigation, global symbol chooser, breadcrumbs, workspace state and data health indicator.
- Shared components: table, chart, price/percent formatter, source/timestamp provenance strip, status, eligibility badge, glossary, error/empty/skeleton, timezone helper.
- Canonical data contract: `value | null`, typed missingness, `observed_at`, `retrieved_at`, `source`, `delay`, `eligibility`, `sample_count`, `calendar` where applicable; actual field names set after source audit.
- No unsolicited models, score formulas, market entitlements, alternative data or derived returns inserted during UI refactor.
- Public methodology + per-module source data documentation; carefully checked download inventory.

## Milestone map
| Milestone | Capability at completion | Target quality gate |
|---|---|---|
| M0 — Verified foundation | Know exact authoritative live source and build path; backed up and versioned | Repo ↔ deployed checksum/route mapping verified |
| M1 — Trustworthy calculations | No missing-data sell signals; consistent scores and timestamps | All negative/edge fixtures and golden numeric tests pass |
| M2 — Transparent information | Data Health reconciles source coverage vs metric freshness, documents verified | Every key metric has traceable provenance, no stale masquerading as live |
| M3 — Professional UI foundation | Koyfin/Finviz/Fiscal-inspired shared tokens and components | Full-route visual review, keyboard and 4-breakpoint acceptance |
| M4 — Research workflows | Terminal, Rankings, Screener, Charts, Analytics, Macro and Documents consistent | Primary user journeys pass e2e and usability testing |
| M5 — Production-quality operations | Stable, fast and rollback-ready production | Release QA, zero critical regressions, monitored performance |

## Measurable acceptance targets (revisit after baseline)
- **100%** of surfaced stance recommendations derived from eligible inputs; missing input cannot silently become strong sell or 0 score.
- **100%** of scored or charted research widgets provide accessible data source and as-of information (or explicitly say unavailable).
- **0** broken public navigation/download links in route crawl; **0** indefinite loading states in tested error scenarios.
- **0** unintentional numeric output differences on fixed golden data after UI refactor.
- **100%** of key desktop and touch workflows tested at 390/768/1024/1440 widths with no clipped core controls.
- **0** production deployments before verified source parity and approved release gate.
- Set measured page performance budgets in Phase 0; target no regressions to baseline and optimize the worst interactions first.

## Explicit non-goals until core is solid
- New subscription models, AI prediction engine, unlicensed realtime options or data feeds.
- Redesign that alters indicator mathematics or strips warnings to make screens appear cleaner.
- Cosmetic reproduction of competitors' proprietary layouts/assets.
- Large-scale frontend rewrite or migrating frameworks without verified necessity.
- Direct production edits bypassing Git, deployment gate and rollback capability.

## Documentation relationship
- [audit.md](audit.md): evidence, defects, improvement levels and acceptance tests.
- [plan.md](plan.md): order of operations, dependencies and completion gates.
- This file: final quality/experience goals, metrics and architecture principles.
