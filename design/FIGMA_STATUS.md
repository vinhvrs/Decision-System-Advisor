# DSA Figma Redesign Status — 2026-11-21

## Scope lock

This branch is design-only until explicit approval.

The current production frontend is NOT a visual baseline.
Allowed reuse later:
- API/data contracts
- validated calculations/business rules
- service integration
- auth/session behavior

Forbidden reuse:
- legacy page layouts
- legacy visual component tree
- legacy CSS shell
- radar-first company architecture
- old page-per-tool navigation patterns

## Figma

File: DSA — True Redesign 2026
File key: TeXnGopCUG3S8EXCtwEuzJ
URL: https://www.figma.com/design/TeXnGopCUG3S8EXCtwEuzJ

Pages:
- 00 — Foundations
- 01 — Master Screens
- 02 — Prototype Flows

## Foundation

Local DSA Terminal design system:
- Geist + Geist Mono
- dark neutral terminal surfaces
- flat 1px separators
- minimal radius
- no gradients
- no glassmorphism
- no legacy card mosaic
- state colors reserved for real state/direction
- missing values remain neutral

Key components:
- Navigation Item — 2:37
- Data Status — 2:40
- Panel Header — 2:43
- Terminal / Command Bar — 3:16
- Terminal / Bottom Status — 3:31
- Terminal / Left Navigation — 3:36
- Company / Research Tab — 6:315
- Company / Period Toggle — 7:394
- Company / Financial Row — 7:397

## Completed master screens

1. Markets — 1440
   - node 4:42
   - broad market pulse
   - heatmap/breadth dominant
   - internals
   - movers/events utility rail

2. Screener — 1440
   - node 5:182
   - filter-first dense grid
   - linked chart/detail panel
   - scan -> inspect without route change

3. Company Overview — 1440
   - node 6:318
   - persistent company context
   - Fiscal-style research hierarchy
   - no radar-first architecture

4. Company Financials — 1440
   - node 8:394
   - annual/quarterly/TTM
   - income statement / balance sheet / cash flow
   - dense statements
   - selected-line trend drawer
   - source/as-of footer

5. Company KPIs — 1440
   - node 9:525
   - company-specific KPI groups
   - trend + history
   - no synthetic KPI score

6. Company Estimates — 1440
   - node 10:608
   - actual vs consensus
   - forward periods visually separated
   - revisions / dispersion / beat-miss
   - partial-coverage handling

7. Company Valuation — 1440
   - node 11:673
   - current vs 5Y history
   - peer comparison
   - no synthetic price target

8. Company Earnings — 1440
   - node 12:746
   - next event
   - beat/miss history
   - revisions
   - event materials/source state

9. Company Ownership — 1440
   - node 13:857
   - institutional holders
   - institutional flow
   - insider Form 4 activity
   - unavailable external disclosures remain explicit

10. Company Filings — 1440
    - node 13:1034
    - chronological SEC feed
    - filing filters
    - metadata/detail viewer
    - no synthesized filing text

11. Chart Lab — 1440
    - node 14:961
    - chart-first workspace
    - series compare
    - intervals/normalization
    - indicators/templates
    - optional OHLC table
    - linked watchlist/screener context

## Design gate

Minimum implementation gate is now satisfied in Figma:
- shell
- Markets
- Screener
- Company Overview
- Financials
- KPIs
- Estimates

However frontend implementation remains blocked pending design approval and completion of the remaining handoff package.

## Pending Figma work

1. Markets — 1920
   - MUST use extra width for additional analytics, not stretch 1440.
   - Planned: sector breadth, cross-asset context, expanded internals + heatmap.

2. Screener + Full Linked Chart — 1440
   - chart becomes dominant
   - result list/grid remains keyboard-navigable and filtered context stays visible

3. Prototype flows
   - A: Command palette -> AAPL -> Company Overview -> Financials -> Estimates
   - B: Screener -> ROE filter -> liquidity sort -> NVDA -> linked chart -> Company
   - C: Markets heatmap -> sector -> Screener -> compare 3 symbols
   - D: Company -> Compare -> peers -> Valuation

4. Responsive behavior board
   - 1280: compressed rail/right-panel behavior
   - 1440: standard desktop
   - 1920: expanded analytical density, no naive stretching

5. Final design inventory / implementation contract board

## Current blocker

Figma MCP Starter-plan tool-call limit was reached while starting Markets — 1920.
The rejected call did not write a partial 1920 frame to the file.

Do not bypass this by implementing the missing design in frontend.
Resume Figma work when tool-call capacity is available.

## Frontend handoff contract after approval

New implementation tree only, e.g.:

frontend/src/new-terminal/
- shell/
- design-system/
- workspaces/markets/
- workspaces/screener/
- workspaces/company/
- workspaces/chart-lab/
- data-adapters/
- state/
- types/

Every implemented screen must map to:
- exact Figma frame
- component variant
- spacing/token value
- state behavior
- breakpoint behavior

No legacy visual component imports.
