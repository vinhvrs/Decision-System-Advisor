# DSA FIGMA DESIGN BRIEF — TRUE REDESIGN

## Goal

Create a completely new desktop-first financial research terminal for DSA.

Do not redesign the existing UI.
Do not import the current layout as a starting point.
Do not preserve existing component placement just because it exists.

The only reusable inputs are product capabilities, data fields, APIs, calculations, and user workflows.

## Reference synthesis

The product should combine three different strengths:

- Koyfin: workspace shell, customization, navigation, command-driven interaction, multi-panel research.
- Finviz: screener density, breadth, filters, heatmaps, rapid scanning, chart+screen workflow.
- Fiscal.ai: company research hierarchy, normalized financial data, estimates, valuation, earnings, ownership, filings.

The result must be original DSA design language.

## Frame 01 — Application shell

Canvas: 1440x900.

Regions:
- 52px collapsible left rail
- 40px top command/context bar
- central workspace canvas
- optional 288px right utility rail
- 24px bottom status strip

Top command bar:
- global symbol/search input;
- active workspace;
- active universe;
- data freshness indicator;
- user/profile utility.

Left rail:
- Markets
- Screener
- Company
- Chart Lab
- Indicators
- News
- Documents
- Watchlists

No traditional website navbar.

## Frame 02 — Markets

Dominant content:
- index/sector heatmap or breadth matrix;
- market regime strip;
- sector performance;
- movers;
- event/news stream;
- watchlist.

Priority is scanability, not card aesthetics.

## Frame 03 — Screener

Primary 70–75% width:
- dense result table.

Left:
- filter builder with grouped categories.

Right:
- linked mini chart + selected-row summary.

Top:
- saved screen selector;
- universe selector;
- add filter;
- columns;
- sort;
- export;
- compare.

Interaction:
Selecting a row updates right chart without leaving the screener.

## Frame 04 — Screener + full linked chart

Result table compresses into left/bottom region.
Chart becomes dominant.
Current filtered list remains navigable with keyboard arrows.

## Frame 05 — Company Overview

Company context header is persistent.

Header:
- logo;
- symbol;
- company;
- exchange;
- validated price/change;
- timestamp;
- watchlist;
- compare.

Below header:
- horizontal research section tabs.

Main overview:
- business summary;
- key financial trend table;
- KPI trend;
- valuation snapshot;
- latest earnings;
- ownership activity;
- latest filing/event;
- news.

No radar as centerpiece.

## Frame 06 — Financials

- period toggle: annual / quarterly / TTM;
- income statement / balance sheet / cash flow;
- expandable line items;
- YoY / QoQ / margins / common-size modes;
- compact chart drawer for selected line item;
- sticky first column;
- source/as-of footer.

## Frame 07 — KPIs

- company-specific operating KPIs;
- metric groups;
- trend chart;
- table with actual/history;
- source/period visibility;
- no score if source inputs incomplete.

## Frame 08 — Estimates

- revenue / EPS / EBITDA / FCF estimates;
- actual vs consensus;
- revisions;
- dispersion;
- beat/miss history;
- source distinction;
- future periods visually separate from reported periods.

## Frame 09 — Valuation

- multiples history;
- current vs historical percentile;
- peer comparison;
- forward vs trailing;
- valuation chart + table;
- no synthetic target.

## Frame 10 — Earnings

- earnings calendar;
- historical beat/miss;
- estimate revisions;
- transcript/event link;
- surprise decomposition.

## Frame 11 — Ownership

- institutional holders;
- changes;
- insider transactions;
- politician trades when available;
- flow timeline.

## Frame 12 — Filings

- chronological filing stream;
- filing type filters;
- key filing metadata;
- document viewer entry;
- source links.

## Frame 13 — Chart Lab

- large chart canvas;
- command-like series selector;
- compare multiple securities/metrics;
- indicator drawer;
- template control;
- interval and normalization;
- optional table bottom panel.

## State frames

Every major frame must include component variants for:
- loading;
- empty;
- partial;
- delayed;
- unavailable;
- not rated;
- stale;
- permission-limited.

Missing data must never use positive/negative market colors.

## Visual language

Dark neutral palette.
Very limited accent usage.
1px separators.
2–6px corner radius range.
No gradients.
No glassmorphism.
No oversized cards.
No large marketing hero headings.
No neon blue glow.
No legacy DSA card style.

## Desktop grid

1440:
- 8px base spacing;
- main content min width ~900;
- rail/right panel fixed or resizable;
- tables optimized for 11–12px data text.

1920:
- do not merely stretch;
- use additional analytical panel or wider table density.

## Prototype flows

Prototype A:
Open command palette → type AAPL → Company Overview → Financials → Estimates.

Prototype B:
Screener → add ROE filter → sort liquidity → select NVDA → inspect linked chart → open full Company view.

Prototype C:
Markets heatmap → select sector → filter into Screener → compare 3 symbols.

Prototype D:
Company → Compare → add peers → valuation comparison.

## Handoff contract

Every implemented frontend screen must reference:
- exact Figma frame;
- component variant;
- spacing/token values;
- state behavior;
- breakpoint behavior.

No developer interpretation that reintroduces legacy layouts.
