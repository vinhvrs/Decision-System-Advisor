# DSA Baseline — 2026-11-18

## Purpose
This branch is the consolidation baseline for the aitemple.tech / DSA cleanup and UI modernization work. It is deliberately separate from the currently running branch so production is not moved, rewritten, force-pushed or merged as part of baseline construction.

## Immutable production checkpoint rule
- Baseline source branch: `codex/realtime-seed-symbols`
- Source head at baseline creation: `889fa28d93d9fdf6fb7842fa62aaebea635de4ab`
- **Do not rewrite, force-push, delete, or merge experimental work into the source branch while it may be serving production.**
- All cleanup/refactor/UI work proceeds from `baseline/dsa-20261118` or child branches.
- Production promotion requires independent verification of the Raspberry Pi checkout/deployed SHA and explicit release approval.

## Branch review summary
| Branch/group | Head/date known | Relationship / decision |
|---|---|---|
| `main` | `29a14d7`, 2026-02-05 | Old baseline only; do not use as current production source. |
| dated Feb–Mar branches | Feb–Mar 2026 | Historical checkpoints; superseded for consolidation unless a missing feature is proven. |
| `pi4-server` | `0d75423`, 2026-03-14 | Historical Pi-specific work; compare selectively, do not wholesale merge. |
| `deploy` | `3268a68`, 2026-04-07 | Ahead of old main but diverged from later lines; historical deployment branch. |
| `05/05/2026` / `refactor` / `thesis` | same `021e2b1` | Same checkpoint; no need to merge three copies. |
| `investing` | `703cea7`, 2026-06-25 | Later feature line but diverged from Nov history; inspect only for missing functionality. |
| `fix/local-mac-stabilization` / `security/history-scrub` | same `a30a8b8`, 2026-11-01 | Same head; substantially diverged. Useful local/security history, not safe wholesale merge. |
| `codex/fix-realtime-board-rows-clean` | `5069b9a`, 2026-11-12 | Direct ancestor of selected source; already included. |
| `codex/realtime-seed-symbols` | `889fa28`, 2026-11-13 | **Selected code baseline source.** Contains realtime-board fix plus 7 later commits. |
| `docs/dsa-trust-ui-roadmap-20261118` | docs only | Do not merge its old-main ancestry; copy only audit/plan/roadmap content into baseline. |

## Why no blanket merge
Several modern-looking branches have unrelated/diverged history. A blanket merge could restore old vendor files, deployment settings, stale application code, or undo security/history cleanup. Consolidation therefore follows **latest safe source + proven selective integration**, not branch-name chronology.

## Already consolidated
- Realtime subscription fixes from `codex/fix-realtime-board-rows-clean` are already ancestors of the selected source.
- `audit.md`, `plan.md`, and `roadmap.md` are copied into this branch without importing stale `main` ancestry.

## Confirmed source-parity blocker — 2026-11-18
An exhaustive GitHub branch-tree scan found **no** `Data Health`, `Market Analytics`, or chart-data-map route source in any historical or likely production branch currently stored in this repository, including `main`, `deploy`, `pi4-server`, `investing`, `fix/local-mac-stabilization`, `security/history-scrub`, `codex/realtime-seed-symbols`, the dated February–March checkpoints, and the 05/05 refactor/thesis checkpoint.

The live site has newer modules than the Git repository. Treat those live modules as **out-of-repository production source** until the Raspberry Pi checkout/uncommitted frontend source is captured and reconciled. The current public terminal also exposes a mixed-asset 40-instrument universe, while the Git Market View/history pipeline inspected here is stock-oriented.

Use `scripts/pi-source-parity.sh` on the Pi before any production promotion. Do not recreate, overwrite, or remove live-only modules from this older Git tree.

Release implication: **no production promotion from this baseline until the live Pi source SHA/working tree and route/build manifests are captured and reconciled into Git.**

## Next branch-audit gate
Before selectively integrating anything from diverged branches:
1. Verify the exact Raspberry Pi production checkout SHA/branch.
2. Compare runtime route manifest and deployed assets against `889fa28d93d9fdf6fb7842fa62aaebea635de4ab`.
3. Identify features present on live but absent in baseline and vice versa.
4. Review candidate commits/file patches individually.
5. Run frontend build/lint and backend tests in a non-production environment.
6. Record any selective merge/cherry-pick in this file and in the PR.

## Baseline status
**SAFE WORKING BASELINE CREATED; PRODUCTION BRANCH UNCHANGED.**
