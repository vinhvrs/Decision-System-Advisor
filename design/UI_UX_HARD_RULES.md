# DSA UI/UX Hard Rules

These rules are mandatory for the true-redesign frontend and override legacy visual conventions.

## Forbidden

- No AI-dashboard aesthetic.
- No decorative card-within-card composition.
- No nested rounded panels to manufacture hierarchy.
- No gradients, including decorative CSS gradients.
- No glassmorphism.
- No glow-heavy blue UI.
- No large ornamental hero sections.
- No marketing-style typography inside research workspaces.
- No arbitrary border radius proliferation.
- No synthetic score or directional color inferred from missing data.
- No fake market price, change, chart, estimate, ranking, or data availability state.
- No legacy visual component imports into `frontend/src/new-terminal/`.

## Required visual language

- Flat professional research terminal.
- Square edges by default; radius only when functionally necessary and minimal.
- 1px separators and surface hierarchy instead of floating cards.
- Dense information layout with readable typography.
- Geist for interface; Geist Mono / tabular numerals for market data.
- Dark neutral surfaces.
- Accent color used sparingly for focus, selection, or interaction.
- Positive/negative colors only when the underlying numeric state is valid.
- Missing, partial, delayed, historical, and unavailable states must be explicit and neutral.
- Source and as-of time remain visible for important derived data.

## Surface and semantic typography contract (mandatory)

- Never place a decorative card/panel inside another card/panel. A workspace may contain adjacent flat sections; inside a section, use rows, columns, tables, tabs and 1px separators, not more framed surfaces.
- Dense grids and market heatmaps are data visualizations, not excuses for card mosaics. Colored heatmap cells must represent valid observed market states; no ornamental color.
- Toolbars, filter groups, indicator lists, alert editors and KPI strips inside panels must be visually flat: no stacked background fills, floating shadows, or duplicate nested borders.
- One loaded UI typeface across all new-terminal workspaces: **Geist**. One loaded data typeface for numerals, tickers, time series, codes and compact control values: **Geist Mono**. Never rely on a font-family name without loading the font; fallback stacks must be shared.
- Typography is assigned by **semantic role**, not by the page/component that happens to render it. Equal-level headings use the same size, weight and base color across Markets, Screener, Company, Chart Lab and support workspaces.
- Shared roles: workspace title; section heading; field/column label; metadata/source/as-of; body/table cell; data value; control label/value; missing/partial state. Each role has one shared CSS token/class contract.
- Size may change across roles or intentional emphasis levels, and color may change for a verified positive/negative state, warning, selected item or interactive focus. Identical meaning and hierarchy must remain typographically identical.
- Market-data values must use tabular figures; status colors must never be inferred from null or missing data. Missing/partial/unavailable values remain neutral.
- Avoid per-component inline font sizes, ad-hoc color literals and local font-family overrides. Extend the semantic tokens when a genuinely new role is required.
- Review new screens at 1280, 1440 and 1920 for accidental nested boxes, inconsistent label/metadata scales, text clipping and readability.

## User-facing information relevance (mandatory)

- The terminal UI is for financial research, not backend operations. Primary surfaces must show market, company, macro, portfolio, screening, charting, events, news, filings, indicators and other investment-relevant information.
- Do not expose operational plumbing such as server status, backend health, pipeline coverage, provider health, ingestion diagnostics, retry/error counters, cache state, entitlement diagnostics, internal data-quality labels or implementation notes as normal user-facing panels.
- Source and as-of metadata may appear only when they materially help interpret a financial observation; keep them compact in table metadata, tooltips, or row details rather than dedicating standalone cards or dashboards to them.
- Missing data should degrade quietly to a neutral dash or concise financial-domain message. Do not fill valuable screen area with "AWAITING", "PARTIAL", "NOT_INGESTED", "LICENSE_RESTRICTED", or similar backend states unless the state itself changes the user's financial interpretation.
- Never add filler cards to occupy space. If an area is sparse, rebalance columns, merge adjacent sections, promote useful financial summaries, or remove the empty region.
- Side rails should be a single flat surface with subsections separated by 1px dividers, not stacks of independent cards.
- Dense summary strips should be one shared surface with equal-height cells and internal dividers; individual metrics must not look like nested cards.
- Page layout should be compact and visually contiguous: align section edges, equalize sibling heights where semantically appropriate, avoid orphan panels, and remove meaningless blank gaps.
- For desktop validation, meaningless blank area must remain below **5% of the visible research workspace**. This is a measurable release gate, not a visual preference.
- Validate each primary route by saving the rendered production HTML, reopening that saved HTML in a headless browser, capturing a screenshot at the target viewport, and measuring low-information blank regions. Repeat layout changes until the route passes the <5% gate.
- Do not satisfy the 5% gate by stretching charts/tables, adding filler cards, duplicating content, or inventing financial data. Reflow real financial content, move long/short sections between columns, merge surfaces, or remove empty regions instead.

## Interaction rules

- Persistent workspace navigation.
- Persistent symbol/universe context.
- Scan -> select -> inspect -> compare without unnecessary route changes.
- Screener keeps filters/results context when opening linked chart or company research.
- Company research is tabbed by analytical domain, not card mosaic.
- Chart Lab makes the chart canvas primary; controls support the chart rather than compete with it.
- 1280 compresses secondary rails.
- 1440 is the standard desktop composition.
- 1920 increases analytical density; it must not merely stretch 1440.

## Pre-deploy gate

Before any production deployment:
1. Build/type/lint checks must pass.
2. Major routes must have SVG structural previews.
3. SVG previews must be reviewed for hierarchy and density.
4. No production deploy until the review gate is accepted.

