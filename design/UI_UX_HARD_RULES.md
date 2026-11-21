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

