# Task 9 — uplot: glyph plot kinds + shared glyph helper

> **Status: TODO**

## Goal

Promote the canvas2d glyph geometry into a shared `adapter-kit/canvas`
helper, then paint the five glyph plot kinds uplot currently buffers but
never draws — `shape` / `character` / `arrow` / `marker` / `label` — via
the uPlot canvas draw hook by consuming that shared helper. The helper
is reused by lwc (Task 11), so the geometry is written once.

## Prerequisites

Task 8 (establishes the override/draw-hook dispatch in
`createUplotAdapter.ts`; land sequentially to avoid a merge).

## Current Behavior

All five glyph kinds buffer into `state.overlays` (`:843-847`) and are
never painted. `canvas2d` has dedicated, tested renderers
(`render/{shape,character,arrow,marker,label}.ts`); uplot has none.

## Desired Behavior

Each glyph renders distinctly through the draw hook + canvas sink at the
plot's shifted x (`shiftedBarTime` → x) and `value` → y:

- `shape`: the eight `shape.shape` glyphs honoring `location`.
- `character`: the `char` text at `size`.
- `arrow`: directional by `direction`.
- `marker`: the marker shape set (circle/triangle-up/triangle-down/
  square/diamond).
- `label`: `text` positioned by `position` (above/below/anchor).

All carry `plot.color`; non-finite `value` ⇒ skip.

## Requirements

### 1. Shared glyph helper + uPlot glyph draw pass

**Decision: factor the glyph geometry into a shared `adapter-kit/canvas`
helper** (the canvas2d glyph renderers are pure-on-`RenderCtx`, hence
model-free). Promote the `shape`/`character`/`arrow`/`marker`/`label`
geometry out of `examples/canvas2d-adapter/src/render/{shape,character,
arrow,marker,label}.ts` into a new `packages/adapter-kit/src/canvas/
glyphs.ts`, exported on the `./canvas` sub-path — mirroring the Task 1
`renderOrder` promotion. The helper draws onto a `RenderCtx`, so uPlot
(this task) and lwc (Task 11) both consume ONE source instead of
hand-porting geometry twice.

Then add a glyph paint pass in the uPlot `draw` hook (after series,
before/after drawings per the z-order — Task 10 wires z; here paint in
declaration order as an interim), driving each glyph through the shared
helper. Clip to the plot bbox via the `rect`/`clip` seam.

Every new export carries `@since 1.6` + a stability marker + `@example`
(adapter-kit is on the in-dev `1.6` line — the interaction-layer exports
already use `@since 1.6`; the `docs:check` gate enforces this on the
`./canvas` surface). The canvas2d glyph renderers are already
pure-on-`RenderCtx` (`render/shape.ts` etc. import `RenderCtx` from
`render/clear.ts`, itself the adapter-kit re-export), so the promotion is
a clean move of RenderCtx-based geometry — not a re-typing.

Refactoring canvas2d to re-consume the promoted helper is **deferred**
(canvas2d's local renderers already work; the promotion only needs to
EXIST in adapter-kit for uplot + lwc) — see README Deferred.

Also update `packages/adapter-kit/CLAUDE.md`: add a canvas-layer
invariant under the "The canvas sink lives under `src/canvas/`…" bullet
recording that the shared glyph geometry (`canvas/glyphs.ts`,
`shape`/`character`/`arrow`/`marker`/`label` on `RenderCtx`) is the ONE
source for the canvas-family adapters (uplot, lwc) — they must consume
it, not hand-port (the same bug class the `shift.ts`/`renderOrder.ts`
promotions kill); canvas2d keeps its local renderers (re-consume
deferred).

### 2. Shifted anchor

Glyphs shift at their `xShift` for parity (canvas2d shifts glyphs).
Route through `shiftedBarTime({ bars, bar, xShift, spacing })` — the
shared contract uplot already uses for series (`:22-25`).

### 3. Tests + docs

- Per-glyph tests via the canvas call-log: the five kinds produce
  distinct call sequences (text vs shaped path vs arrow); `location` /
  `direction` / `char` / `text` reflected.
- Non-finite `value` ⇒ no glyph.
- Update `examples/uplot-adapter/CLAUDE.md`: glyph draw-hook rendering
  + the geometry-reuse decision.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/canvas/glyphs.ts` | Create | Shared model-free glyph geometry (on `RenderCtx`) |
| `packages/adapter-kit/src/canvas/glyphs.test.ts` | Create | 100% coverage of the shared glyph helper |
| `packages/adapter-kit/src/canvas/index.ts` | Modify | Export the glyph helper on the `./canvas` sub-path |
| `packages/adapter-kit/CLAUDE.md` | Modify | Canvas-layer invariant for the shared glyph geometry (consume, don't hand-port) |
| `src/createUplotAdapter.ts` | Modify | Glyph draw pass (consumes the shared helper) |
| `src/createUplotAdapter.test.ts` | Modify | Per-glyph call-log tests |
| `examples/uplot-adapter/CLAUDE.md` | Modify | Glyph rendering invariant |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (uplot + adapter-kit 100% coverage)
- `pnpm conformance`
- `pnpm adapters:generate` + `pnpm adapters:gate`
- `pnpm docs:check` (JSDoc `@since` / `@example` / stability on the new
  adapter-kit glyph exports)

## Changeset

`.changeset/uplot-glyphs.md` — private example package (empty
changeset). The shared glyph helper adds adapter-kit public surface, so
ALSO add `.changeset/adapter-kit-canvas-glyphs.md` — **minor** for
`@invinite-org/chartlang-adapter-kit` (new `./canvas` surface).

## Acceptance Criteria

- Shared glyph helper landed in `adapter-kit/canvas` (model-free, on
  `RenderCtx`), exported on `./canvas`, with full JSDoc (`@since 1.6` +
  stability + `@example`) + 100% coverage + a **minor** adapter-kit
  changeset + a `packages/adapter-kit/CLAUDE.md` invariant.
- Five glyph kinds render distinctly via the draw hook, consuming the
  shared helper (no re-derived geometry); per-kind tests.
- uplot + adapter-kit at 100% coverage; conformance + `adapters:gate`
  green; `CLAUDE.md` updated; both changesets committed.
