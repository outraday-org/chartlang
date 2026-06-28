# TA — Pivots, Fractals & Series Utilities

> **Status: TODO**

## Goal

One runnable example per pivot/fractal/zigzag primitive and per
series-utility `ta.*` helper, category `ta-pivots-utility`; shrink the
allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). The series utilities
(`highest`, `lowest`, `barssince`, `valuewhen`, `change`, `median`,
`nz`, `crossover`, `crossunder`) are building blocks — each example
uses the helper to drive a visible plot or `alert` so its effect is
observable. Pivot/fractal/zigzag examples mark detected points (e.g.
`plot` the pivot price as a stepped series, or use a `draw.*` marker if
already covered elsewhere — but the canonical id here is the `ta.*`
detector, so keep the focus on the `ta` call).

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.pivotsHighLow` | covered (`pivot-high-ray`) | — |
| `ta.pivotsStandard` | new | Classic floor pivots (PP/R1-3/S1-3) overlay. |
| `ta.williamsFractal` | new | Williams up/down fractal markers. |
| `ta.zigZag` | new | ZigZag(5%) swing line overlay. |
| `ta.highest` | new | Rolling highest-high(20) channel top. |
| `ta.lowest` | new | Rolling lowest-low(20) channel bottom. |
| `ta.highestbars` | new | Bars-since-highest offset oscillator. |
| `ta.lowestbars` | new | Bars-since-lowest offset oscillator. |
| `ta.barssince` | new | Bars since last RSI>70 (counter plot). |
| `ta.valuewhen` | new | Price at the most recent crossover event. |
| `ta.change` | new | Bar-over-bar change of close. |
| `ta.median` | new | Rolling median(20) overlay. |
| `ta.nz` | new | `nz` filling a warmup-NaN series to 0. |
| `ta.crossover` | covered (`ema-cross`) | — |
| `ta.crossunder` | covered (`ema-cross`) | — |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×12 new) | Create | One per uncovered id. |
| `examples/catalogue/ta-pivots-utilities.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×12) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-pivots-utilities.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id, each making the
  helper's effect observable; catalogue + allowlist updated; generators
  re-run; gates green. This task completes `ta.*` coverage.
