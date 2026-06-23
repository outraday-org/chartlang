# Task 3 — canvas2d: line-family `colorValue` (reference pattern)

> **Status: TODO**

## Goal

Make the reference adapter honor the per-bar dynamic-color channel
`PlotEmission.colorValue` for line-family plots (`line` / `step-line` /
`area` / `histogram`), implementing the normative 3-state precedence
contract. This establishes the per-segment-recolor pattern that
echarts (Task 5), konva (Task 7), uplot (Task 10), and
lightweight-charts (Task 13) mirror.

## Prerequisites

Task 1. (Independent of Task 2, but both touch `applyPlot` — land Task
2 first to avoid a merge.)

## Current Behavior

`applyPlot` (`createCanvas2dAdapter.ts:784`) stores only
`color: plot.color` on each `PlotPoint`; `PlotPoint`
(`render/coords.ts:47`) has no `colorValue` field. `drawLine`
(`render/line.ts:47`) reads `firstFinite.color ?? plotDefault` — a
single per-series color. The runtime DOES emit `colorValue` for line
plots (`runtime/src/emit/plot.ts:144-167`), so a per-bar dynamic line/
histogram color (and the `null` paint-nothing gap) is silently dropped.
`bg-color` / `bar-color` already honor `colorValue` 3-state
(`render/bgColor.ts:43`; `:457-467`) — the reference for the contract.

## Desired Behavior

For line-family plots, per the `PlotEmission.colorValue` JSDoc
(`adapter-kit/src/types.ts:582`):

- **omitted** ⇒ use the static `plot.color` (today's behavior;
  byte-identical when no `colorValue` is on the wire).
- **present** ⇒ that bar's segment paints in `colorValue`, overriding
  the static color.
- **`null`** ⇒ explicit "no color this bar" — paint nothing for that
  bar's segment (a gap, distinct from omitted).

Because a polyline crosses bars, the per-bar override means the line is
painted as consecutive same-color **runs**: a color change starts a new
stroked sub-path; a `null` bar breaks the path like a `value:null` gap.

## Requirements

### 1. `PlotPoint` carries `colorValue`

In `render/coords.ts`, add `readonly colorValue?: string | null` to
`PlotPoint`. Omit it on the stored point when the emission's
`colorValue` is absent (so a no-`colorValue` frame is byte-identical to
the pre-feature `PlotPoint` and existing goldens hold). In `applyPlot`
(`:784-795`), thread `...(plot.colorValue === undefined ? {} :
{ colorValue: plot.colorValue })`.

### 2. Per-run rendering in `render/line.ts` + `render/histogram.ts` + `render/area.ts`

Resolve each bar's paint color as `point.colorValue === undefined ?
(point.color ?? plotDefault) : point.colorValue`. Then:

- **line / step-line / area**: walk the points; emit a stroked
  sub-path per maximal run of bars sharing a resolved color; a
  `colorValue === null` bar ends the current run and starts NO new
  segment until the next finite-colored bar (gap). This composes with
  the existing `value:null` gap break — either condition breaks the
  sub-path. Area fill follows the same runs (fill each run's polygon
  with that run's color at `fillAlpha`).
- **histogram**: each bar is already an independent column — resolve
  its color per bar; a `null` bar paints no column.

Keep the no-`colorValue` path emitting exactly the current single-color
call sequence so the existing per-renderer golden tests
(`line.test.ts`, `histogram.test.ts`, `area.test.ts`) are unchanged for
omitted-`colorValue` inputs.

### 3. Tests

Add to each renderer's test + `createCanvas2dAdapter.test.ts`:

- omitted `colorValue` ⇒ identical call log to the static-color case.
- present `colorValue` on a subset of bars ⇒ the run boundaries +
  per-run `strokeStyle` are asserted.
- `colorValue: null` on a mid-series bar ⇒ a gap (sub-path break, no
  stroke for that bar).
- A `colorValue` that equals the static color ⇒ still one run (no
  spurious split — or document/accept a split; prefer coalescing).

### 4. Edge cases + docs

- `colorValue` is orthogonal to `value`: a finite `value` with
  `colorValue: null` draws no segment but still counts for y-scale
  (it is a real numeric point — confirm `computePaneViewport` still
  includes it; only the *paint* is suppressed).
- Non-finite `value` remains a gap regardless of `colorValue`.
- Add a line-family `colorValue` invariant (3-state, per-run rendering)
  to `examples/canvas2d-adapter/CLAUDE.md` — realize the normative
  3-state contract already documented in
  `packages/adapter-kit/CLAUDE.md` ("Wire + capability invariants",
  which names line-family's static color as the top-level `color`).
  Note: canvas2d's `CLAUDE.md` has no existing bg/bar-color colorValue
  section, so add this as a new bullet (e.g. under the Z-order /
  Phase-5 invariants), not "next to" a pre-existing note.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/render/coords.ts` | Modify | `PlotPoint.colorValue?: string \| null` |
| `src/createCanvas2dAdapter.ts` | Modify | Thread `colorValue` onto stored points |
| `src/render/line.ts` | Modify | Per-run line/step rendering |
| `src/render/histogram.ts` | Modify | Per-bar colorValue |
| `src/render/area.ts` | Modify | Per-run area fill |
| `src/render/{line,histogram,area}.test.ts` | Modify | colorValue cases |
| `src/createCanvas2dAdapter.test.ts` | Modify | End-to-end colorValue cases |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | Line-family colorValue invariant |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (canvas2d 100% coverage — every run/gap branch covered)
- `pnpm conformance` (plot-hash unaffected)
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check`

## Changeset

`.changeset/canvas2d-line-colorvalue.md` — private example package
(empty changeset).

## Acceptance Criteria

- Line/step/area/histogram honor `colorValue` 3-state; per-run + gap
  branches at 100% coverage.
- Omitted-`colorValue` call logs are byte-identical to today (existing
  goldens hold).
- `CLAUDE.md` documents the pattern; `adapters:gate` green; changeset
  committed.
