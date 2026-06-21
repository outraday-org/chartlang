# Task 4 — Adapter-kit contract + every adapter honors `visible`

> **Status: TODO**

## Goal

Define the adapter contract for `PlotEmission.visible` and implement it in the
reference canvas2d adapter (and any other in-repo adapters): when
`visible === false`, the adapter **does not render** that plot's mark for that
bar, and does so **without** introducing a series-gap artifact (it is not the
same as a `value: null` hole). Visibility is universally supported — there is
**no** capability gate (an adapter that can draw a plot can also skip it).

## Prerequisites

Task 1 (wire field), Task 3 (runtime sets the field).

## Current Behavior

- The adapter contract is `Adapter.onEmissions(RunnerEmissions)`
  (`packages/adapter-kit/src/types.ts`), gated per kind by
  `Capabilities.plots`. `PlotEmission.visible`'s JSDoc (@since 0.8) already
  states the obligation: "the adapter SHOULD skip rendering and y-scale
  inclusion but keep the slot listed."
- **The reference canvas2d adapter ALREADY honours it**:
  `createCanvas2dAdapter.ts` short-circuits the plot render with
  `if (plot.visible === false) return;`. So the host-override-driven `visible`
  path is already end-to-end. T8 only needs to (a) verify that same guard
  covers the now-authoring-driven `visible: false` (it does — same field),
  (b) extend the skip to any OTHER in-repo adapter that does not yet have it,
  and (c) confirm/strengthen the adapter-kit CONTRACT docs if the obligation
  isn't fully spelled out for every kind.
- `value: null` is the existing "skip this bar" — it breaks line continuity
  (the line segment is not drawn across the null). Visibility must NOT reuse
  this path (a hidden plot is not a per-bar hole; it is the whole mark
  suppressed).

## Desired Behavior

- An emission with `visible === false` is **not drawn** by any adapter.
- An emission with `visible` absent or `true` renders exactly as today
  (byte-identical behaviour for every existing scenario).
- For v1 (constant boolean), a `visible: false` plot is hidden for all bars, so
  the whole series simply isn't drawn — no partial line, no gap markers, no
  legend ghost. (Per-bar visibility is a documented follow-up; the contract is
  written so a future per-bar boolean "skip this bar's mark, keep the
  surrounding line continuous" is expressible — distinct from `value: null`.)

## Requirements

### 1. Adapter-kit contract docs (`packages/adapter-kit/src/types.ts` + CLAUDE.md)

Document on `PlotEmission.visible` and in `packages/adapter-kit/CLAUDE.md` the
adapter obligation:

> When `visible === false`, an adapter MUST skip rendering this emission's
> mark and MUST NOT draw it as a gap/break (that is `value: null`'s job).
> Omitted/`true` ⇒ draw normally. No capability gates visibility — every
> adapter honours it.

### 2. Reference canvas2d adapter (`examples/canvas2d-adapter/src/`) — verify (already implemented)

The dispatch already short-circuits with `if (plot.visible === false) return;`
(`createCanvas2dAdapter.ts`). **Verify** it covers every plot kind reached
through that path (line/histogram/area/band/marker/bg-color/bar-color) and that
it also fires for the authoring-driven `visible: false` (same field). Only add
code if a kind bypasses the guard. Ensure a hidden line leaves no dangling
segment (since v1 hides the whole series, this is naturally satisfied).

### 3. Any other in-repo adapters

Apply the same skip to every adapter under `examples/` / `packages/` that
implements `onEmissions` (mirror the canvas2d change). If a multi-library
adapter set exists, thread the skip through each.

### 4. Tests

- Reference adapter unit test: an emission stream where one plot is
  `visible: false` renders the same pixels/commands as a stream that omits that
  plot entirely (assert the hidden plot produces zero draw calls).
- A `visible`-absent stream renders byte-identically to the pre-change adapter
  (regression).

## Edge cases

- `bg-color` / `bar-color` with `visible: false` → skip the background/tint
  fill for that bar (these are emissions too).
- A `visible: false` emission still participates in dedup/manifest (it exists,
  it's just not drawn) — do not drop it earlier in the pipeline.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Document the `visible` render obligation. |
| `packages/adapter-kit/CLAUDE.md` | Modify | Adapter contract for `visible`. |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` + per-kind renderers | Modify | Skip render when `visible === false`. |
| other in-repo adapters' `onEmissions` | Modify | Same skip. |
| `examples/canvas2d-adapter/src/*.test.ts` | Modify | Hidden-plot = zero draw calls; visible-absent regression. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- adapter package test(s) (canvas2d + any others)
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T8 changeset. **No adapter-kit version bump** — its
`visible` wire field, validator, and JSDoc obligation already exist (@since 0.8);
this task is verify + (if any other adapter lacks the skip) a patch on that
adapter example package only.

## Acceptance Criteria

- `visible: false` ⇒ the plot is not drawn on every in-repo adapter, with no
  series-gap artifact.
- `visible` absent/`true` ⇒ byte-identical rendering to today.
- adapter-kit CLAUDE.md documents the obligation; adapter tests green.
