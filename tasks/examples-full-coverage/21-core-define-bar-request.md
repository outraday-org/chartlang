# Core — Define Overrides, Bar, Context & Request

> **Status: TODO**

## Goal

One runnable example per `define.*` override, the read-only context
namespaces (`barstate`, `syminfo`, `timeframe`), and
`request.security` / `request.lowerTf`, category `define-bar-context`;
shrink the allowlist by these ids. This task completes the non-ta/draw
primitive coverage.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per the base rules in [Task 3](./3-ta-moving-averages.md).

- **`define.*` overrides** are fields on the `defineIndicator({...})`
  options object (`format`, `maxBarsBack`, `precision`,
  `requiresIntervals`, `scale`, `shortName`), not `compute`-body calls.
  Each example sets the override at the top level and plots something so
  the script is runnable; the comment explains the override's effect.
  Check `docs/primitives/define/<name>.md` for the exact field shape.
- **`barstate` / `syminfo` / `timeframe`** are read-only context
  namespaces. Each example reads from the namespace (e.g.
  `barstate.isConfirmed`, `syminfo.mintick`, `timeframe.period`) and
  uses the value to gate an `alert` or drive a `plot`.
- **`request.security`** is already covered by `htf-trend-filter`
  (skip if absent from the allowlist). **`request.lowerTf`** needs an
  intrabar lower-timeframe stream — the demo's `ChartPane` feeds
  synthetic streams from `requestedIntervals` (see `apps/CLAUDE.md`).
  Author the example so it compiles + runs clean even when the demo
  cannot supply true sub-bar data (NaN render tolerated, no throw);
  document the intrabar semantics in the comment.

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `define.format` | new | `format` override (price/volume/percent). |
| `define.maxBarsBack` | new | `maxBarsBack` override sizing the history buffer. |
| `define.precision` | new | `precision` override on plotted values. |
| `define.requiresIntervals` | new | `requiresIntervals` declaring an MTF dependency. |
| `define.scale` | new | `scale` override (price vs separate scale). |
| `define.shortName` | new | `shortName` override shown in the legend. |
| `barstate` | new | Gate an `alert` on `barstate.isConfirmed`. |
| `syminfo` | covered (`mintick-snapped-entry`) | Uses `syminfo.mintick` to snap a level — credited to the migrated composite (Task 1 §6); skip if absent from the allowlist. |
| `timeframe` | new | Branch behavior on `timeframe.period`. |
| `request.security` | covered (`htf-trend-filter`) | — |
| `request.lowerTf` | new | Pull intrabar data via `request.lowerTf`. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×9 new) | Create | One per uncovered id (`request.security` + `syminfo` are covered by migrated composites). |
| `examples/catalogue/core-define-bar-request.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-core-define-bar-request.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id; `request.lowerTf`
  runs clean under the demo's stream feeder; catalogue + allowlist
  updated; generators re-run; gates green. After this task the
  allowlist should contain **zero** ids.
