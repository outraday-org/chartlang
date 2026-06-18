# adapter-kit geometry: curves, freehand, channels, fibonacci

> **Status: TODO**

## Goal

Extend `decomposeDrawing` (from Task 1) with the curve, freehand,
channel, and Fibonacci drawing kinds — 20 of the remaining 43 kinds
(Task 1 covered 19) — each as a pure `(state, view) => DrawPrimitive[]`
decomposer ported from the matching canvas2d renderer's geometry.

## Prerequisites

- Task 1 (geometry foundation: IR, projection, `_lib`, dispatcher,
  canvas sink).

## Current Behavior

After Task 1, `decomposeDrawing` returns `DrawPrimitive[]` for the basic
kinds and `[]` (placeholder default) for everything else. The curve /
freehand / channel / fibonacci geometry still lives only in the canvas2d
renderers.

## Desired Behavior

`decomposeDrawing` returns correct `DrawPrimitive[]` for all 20 kinds in
this task, with the fib-level helper shared in `_lib`.

## Requirements

### 1. Curves — `geometry/kinds/curves.ts` (3 kinds)

`arc`, `curve`, `double-curve`. Port from
`examples/canvas2d-adapter/src/render/draw/{arc,curve,doubleCurve}.ts`.
Sample the bezier/quadratic paths via `_lib/bezier` and emit a single
`polyline` primitive (open) per curve segment. `arc` may emit an `arc`
primitive directly when it is a true circular arc.

### 2. Freehand — `geometry/kinds/freehand.ts` (3 kinds)

`pen`, `highlighter`, `brush`. Port from `{pen,highlighter,brush}.ts`.

- `pen` → open `polyline` (stroke only).
- `highlighter` → `polyline` with a thick stroke at the fixed
  `HighlighterStyle.alpha` (carry alpha on the `StrokeStyle`? No — stroke
  has no alpha field; emit the alpha by pre-multiplying into the color or
  add a wide semi-transparent stroke. Match canvas2d: it sets
  `globalAlpha`. Represent as a `polyline` whose `stroke.color` already
  encodes alpha via rgba, OR add `alpha` to `StrokeStyle`.) **Decision:**
  add an optional `alpha?: number` to `StrokeStyle` in
  `geometry/types.ts` (default opaque) and have `paintPrimitive` set
  `ctx.globalAlpha` around the stroke. Update Task 1's `paintPrimitive`
  test expectations accordingly (this is the one IR addition this task
  makes — keep it minimal).
- `brush` → `polyline` with both `stroke` and `fill` (closed when the
  source closes it).

> Adding `StrokeStyle.alpha` is a backward-compatible optional field;
> the basic decomposers from Task 1 simply omit it.

### 3. Channels — `geometry/kinds/channels.ts` (4 kinds)

`trend-channel`, `flat-top-bottom`, `disjoint-channel`,
`regression-trend`. Port from
`{trendChannel,flatTopBottom,disjointChannel,regressionTrend}.ts`. Each
emits multiple `polyline` primitives (the parallel rails) plus an
optional filled `polyline` between rails (use `fill` with the channel's
alpha). `regression-trend` computes the regression line + optional
upper/lower std-dev bands from `RegressionTrendOpts` — port the math
exactly; it does **not** read bar data here (state carries the computed
anchors), so keep it pure on `state`.

### 4. Fibonacci — `geometry/kinds/fibonacci.ts` (10 kinds)

`fib-retracement`, `fib-trend-extension`, `fib-channel`,
`fib-time-zone`, `fib-wedge`, `fib-speed-fan`, `fib-speed-arcs`,
`fib-spiral`, `fib-circles`, `fib-trend-time`. Port from the 10
`fib*.ts` renderers.

- Shared levels helper: create `geometry/_lib/fibLevels.ts` holding the
  default level array (`[0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272,
  1.618, 2.618, 4.236]`) and any level-projection helper used by more
  than one fib decomposer. Reuse `FibOpts.levels` override.
- Each level line → a `polyline` (+ optional `text` label when
  `showLabels`). `fib-spiral` → sampled `polyline` (port the golden-ratio
  bezier sweep from `fibSpiral.ts`). `fib-speed-arcs` / `fib-circles` →
  `arc` primitives. `fib-time-zone` → vertical `polyline`s at fib-spaced
  times.

### 5. Wire into the dispatcher

Add the 20 `case` arms to `geometry/decompose.ts`, delegating to the new
decomposers. Keep the placeholder `default` (Task 3 removes it once all
62 are covered).

### Edge cases

- Fib level override (`FibOpts.levels`) replaces the default array; empty
  array → no level lines (match source).
- `fib-spiral` / `fib-circles` with zero radius → early return `[]`
  (mirror `if (r === 0) return`).
- Channel rails with parallel-degenerate anchors must not divide by zero.
- `highlighter`/`brush` alpha defaults must match the source styles.
- Label visibility (`showLabels` default) must match each fib renderer.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/geometry/types.ts` | Modify | add optional `StrokeStyle.alpha` |
| `packages/adapter-kit/src/canvas/paintPrimitive.ts` (+test) | Modify | honor `StrokeStyle.alpha` via `globalAlpha` |
| `packages/adapter-kit/src/geometry/kinds/{curves,freehand,channels,fibonacci}.ts` (+tests) | Create | 20 decomposers |
| `packages/adapter-kit/src/geometry/_lib/fibLevels.ts` (+test) | Create | shared fib levels |
| `packages/adapter-kit/src/geometry/decompose.ts` (+test) | Modify | add 20 arms |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (adapter-kit 100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/adapter-kit-geometry-curves-fib.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (extends the public decomposer
coverage; new optional IR field).

## Acceptance Criteria

- `decomposeDrawing` returns correct primitives for all 20 curve /
  freehand / channel / fibonacci kinds, verified by per-kind unit tests
  against representative anchors.
- `StrokeStyle.alpha` added (optional) and honored by `paintPrimitive`;
  Task 1's paint tests updated.
- Shared `_lib/fibLevels.ts` reused by every fib decomposer (no parallel
  level arrays).
- 100% coverage; JSDoc gate green; changeset committed (minor).
