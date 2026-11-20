# DSA TRUE REDESIGN PLAN — 2026-11-21

## Mandate

This redesign starts from zero at the UX/UI layer.

The existing frontend is NOT a design baseline. It may be consulted only for:
- data contracts;
- service/API integration;
- authentication/session behavior;
- routing requirements that must remain reachable;
- business rules and validated calculations.

The following are explicitly prohibited during the design phase:
- reusing current page layouts;
- reusing current component trees as visual templates;
- reskinning legacy screens;
- copying current spacing/card/table hierarchy;
- preserving old radar-first or page-per-tool workflows merely because they already exist;
- implementing React before the approved Figma design contract is complete.

## Product references and role split

### Koyfin — workspace architecture
Use as reference for:
- persistent left navigation;
- command/search workflow;
- customizable workspaces and widgets;
- compact, professional terminal density;
- ticker-centric context switching;
- right utility rail / watchlist / news context;
- multi-panel analysis without unnecessary route switching.

Do not copy Koyfin branding or exact visuals.

### Finviz — scanning architecture
Use as reference for:
- high-density screener;
- filter-first workflows;
- instant sortable/scannable tabular output;
- breadth / heatmap / movers;
- chart + screener coexistence;
- low-friction market scanning.

Do not copy Finviz branding or exact visuals.

### Fiscal.ai — company research architecture
Use as reference for:
- company-centric research hierarchy;
- Financials;
- KPIs;
- Estimates;
- Valuation;
- Earnings;
- Ownership;
- Filings;
- explicit source and as-of state;
- structured research navigation rather than dashboard-card sprawl.

Do not copy Fiscal.ai branding or exact visuals.

## Core UX principle

DSA becomes one research workstation, not a collection of web pages.

A symbol, market universe, or research context should remain active while the user moves between views.

The interface must optimize for:
1. scan;
2. select;
3. inspect;
4. compare;
5. drill down;
6. return without losing context.

## New information architecture

### Global shell
- Primary left navigation
- Universal command/search bar
- Active workspace/ticker context
- Optional right context rail
- Bottom status/data-health strip
- Workspace tabs across the top of the main canvas

### Primary workspaces
1. Markets
2. Screener
3. Company
4. Chart Lab
5. Indicators
6. News / Events
7. Documents
8. Watchlists

These are workspaces, not independent website pages.

## Markets workspace

Purpose: broad market situational awareness.

Layout:
- top context bar: index/market regime + session + freshness;
- main center: breadth/heatmap;
- left or lower stack: indices / sectors / themes;
- right rail: movers, news, event queue;
- lower panel: watchlist performance + market internals.

No decorative dashboard cards.

## Screener workspace

Purpose: rapid scanning and triage.

Layout:
- compact filter rail;
- result table as dominant surface;
- multi-column presets;
- saved screens;
- row selection keeps result context;
- linked chart/details panel;
- keyboard navigation;
- multi-select compare.

The user must be able to screen and inspect charts without leaving the workspace.

## Company workspace

Purpose: complete equity research.

Persistent company header:
- symbol / company / exchange;
- live or last validated price;
- session change;
- source / timestamp;
- watchlist action;
- compare action.

Primary research tabs:
1. Overview
2. Financials
3. KPIs
4. Estimates
5. Valuation
6. Earnings
7. Ownership
8. Filings
9. News
10. Chart

Overview is a research summary, not a radar dashboard.

## Chart Lab

Purpose: Koyfin-style visual analysis.

- multi-series charting;
- comparison symbols;
- normalized / absolute / % change modes;
- interval controls;
- indicators;
- saved templates;
- linked screener/watchlist selection;
- optional bottom data table.

## Design system direction

### Visual character
- dark professional terminal;
- flat surfaces;
- restrained depth;
- no gradients;
- minimal rounding;
- dense but readable;
- no oversized marketing typography;
- no decorative card mosaics;
- avoid legacy blue-glow aesthetic.

### Density
Desktop-first.
Designed for 1440px and 1920px primary canvases, with acceptable laptop compression at 1280px.

### Typography
- UI sans for labels/navigation;
- mono/tabular numerals for market data;
- strict size hierarchy;
- small text remains legible and high-contrast.

### Color
Color communicates state only:
- bullish/positive;
- bearish/negative;
- warning/partial;
- error/unavailable;
- selected/focus.

Missing data is neutral.

### Components to design from scratch
- app shell;
- command palette;
- nav rail;
- workspace tabs;
- panel header;
- data grid;
- filter builder;
- heatmap;
- watchlist;
- company header;
- research tabs;
- metric table;
- estimate revisions;
- ownership table;
- filing timeline;
- chart toolbar;
- status/freshness badge;
- empty/partial/unavailable states.

## Data integrity contract

UI must never:
- replace missing with 0;
- infer bearish from missing;
- infer bullish from missing;
- label a dataset available before a successful source response;
- show synthetic price/change as real;
- hide timestamp/source state for important derived metrics.

Required states:
- Live
- Delayed
- Historical
- Partial
- Awaiting data
- Unavailable
- Not Rated

## Figma gate

No frontend implementation before all of these exist in Figma:

### Foundation
- design tokens;
- typography;
- spacing;
- grids;
- color/state system;
- icon conventions.

### Desktop master frames
- Markets 1440
- Markets 1920
- Screener 1440
- Screener + linked chart 1440
- Company Overview 1440
- Company Financials 1440
- Company KPIs 1440
- Company Estimates 1440
- Company Valuation 1440
- Company Earnings 1440
- Company Ownership 1440
- Company Filings 1440
- Chart Lab 1440

### Interaction prototypes
- universal search → switch symbol;
- screener filter → row selection → linked chart;
- company tab switching;
- compare 2–4 companies;
- right rail open/close;
- missing/partial data behavior;
- keyboard focus and command palette.

## Approval gate

Frontend coding may start only when:
- the complete shell is approved;
- Markets is approved;
- Screener is approved;
- Company Overview + at least Financials/KPIs/Estimates are approved;
- responsive/laptop behavior is defined;
- component inventory is stable.

## Implementation gate after Figma approval

Create a NEW frontend namespace/tree.

Rules:
- no legacy visual component imports;
- legacy services can be wrapped by new adapters;
- no CSS inheritance from old page-specific design system;
- no old page layout copied into the new tree;
- migration happens workspace-by-workspace;
- old frontend remains isolated until replacement is complete.

## Proposed implementation structure after design approval

frontend/src/new-terminal/
- shell/
- design-system/
- workspaces/markets/
- workspaces/screener/
- workspaces/company/
- workspaces/chart-lab/
- workspaces/indicators/
- workspaces/news/
- workspaces/documents/
- data-adapters/
- state/
- types/

## Migration sequence

Phase A — Design only
1. Product architecture
2. UX flows
3. Wireframes
4. Design system
5. High-fidelity Figma
6. Interactive prototype
7. Approval

Phase B — New frontend foundation
1. New shell
2. design tokens
3. routing/workspace state
4. data adapters
5. command/search

Phase C — Workspaces
1. Markets
2. Screener
3. Company
4. Chart Lab
5. remaining modules

Phase D — Cutover
1. side-by-side verification
2. data parity
3. interaction QA
4. aitemple.tech cutover
5. remove legacy frontend only after stability

## Non-negotiable acceptance criteria

- looks structurally unrelated to the May–June 2026 frontend;
- no radar-first home/company design;
- no generic card dashboard as primary architecture;
- no route hopping for simple scan-to-inspect workflows;
- no synthetic/missing-data ambiguity;
- visual language is coherent across every workspace;
- keyboard and dense desktop workflows are first-class;
- every core screen is traceable to the approved Figma frame.
