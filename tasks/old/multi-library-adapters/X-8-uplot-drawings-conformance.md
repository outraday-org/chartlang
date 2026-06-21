# uPlot adapter: drawings + conformance

> **Status: TODO**

## Goal

Complete the uPlot adapter: render all 63 drawing kinds inside uPlot's
`hooks.draw` by painting `decomposeDrawing(emission, viewport)` to the
canvas `ctx` via `paintPrimitive`, with the `Viewport` built from uPlot's
`valToPos`. Add the hashed integration test, wire conformance, ship README
+ docs.

## Prerequisites

- Task 7 (uPlot scaffold + series, ctx-hook established for hlines).
- Tasks 1–3.

## Current Behavior

After Task 7 the adapter renders candles/plots/hlines/panes and buffers
drawings without painting.

## Desired Behavior

Drawings paint in the draw hook; adapter is full-surface, conformance-green.

## Requirements

### 1. Viewport from uPlot — `src/viewport.ts`

`buildViewport(u): Viewport` for the overlay instance:

```ts
// uPlot exposes valToPos(val, scaleKey, canPx=true) → pixel
const view: Viewport = {
    xMin: u.scales.x.min, xMax: u.scales.x.max,
    yMin: u.scales[priceScale].min, yMax: u.scales[priceScale].max,
    pxWidth: u.bbox.width / devicePixelRatio,
    pxHeight: u.bbox.height / devicePixelRatio,
};
```

uPlot's x scale is time, y scale is price — linear by default, so
adapter-kit's linear `timeToX`/`priceToY` over this `Viewport` reproduce
`valToPos`. Verify in a test (sample a few points against `u.valToPos`).
Account for the plotting-area offset (`u.bbox.left/top`) when painting
into the full-canvas ctx — translate or add the offset into the viewport
math; document which.

### 2. Drawings in the draw hook — extend `createUplotAdapter`

In the overlay instance's `hooks.draw` (established in Task 7 for hlines),
after hlines:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

const view = buildViewport(u);
for (const d of state.drawings.values()) {
    if (d.op === "remove") continue;
    for (const prim of decomposeDrawing(d, view)) paintPrimitive(u.ctx, prim);
}
```

`u.ctx` is a real `CanvasRenderingContext2D` ⊇ `RenderCtx`.

### 3. Integration test — `src/integration.test.ts`

Mirror canvas2d: inline indicator emitting plots + drawings, driven
through the factory with a `MockCanvasContext` as `u.ctx`, pin a
`hashCallLog` constant over the drawing calls.

### 4. Conformance test — `src/conformance.test.ts`

`runConformanceSuite(default)` → `failed === 0`.

### 5. README + docs

- `README.md` (≤ 100 lines): purpose, install, public surface, draw-hook
  rendering note, license.
- `docs/adapters/reference/uplot.md` (per-library pages live under
  `docs/adapters/reference/`, matching the established vitepress
  convention; Task 13 wires the nav).

### Edge cases

- Plotting-area offset (`bbox.left/top`) correctly applied so drawings
  align with series.
- `op: "remove"` skipped.
- NaN anchors → ctx no-op.
- Sub-pane drawings render against the overlay instance viewport (match
  canvas2d overlay-tail).
- `devicePixelRatio` scaling: uPlot scales its canvas; ensure the viewport
  `pxWidth/pxHeight` are in CSS px so `paintPrimitive` coordinates match.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.../src/viewport.ts` (+test) | Create | `Viewport` from `valToPos` |
| `.../src/createUplotAdapter.ts` | Modify | paint drawings in draw hook |
| `.../src/integration.test.ts` | Create | hashed plots+drawings |
| `.../src/conformance.test.ts` | Create | conformance green |
| `.../README.md` | Modify | full surface docs |
| `docs/adapters/reference/uplot.md` | Create | adapter guide |
| `examples/uplot-adapter/CLAUDE.md` | Modify | draw-hook drawings; dpr/offset notes |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm conformance`
- `pnpm docs:check` / `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- All 63 drawings paint in the draw hook via
  `decomposeDrawing`/`paintPrimitive`; hashed integration test pinned;
  viewport verified against `u.valToPos`.
- `runConformanceSuite(default)` → `failed === 0`.
- README ≤ 100 lines; docs page added; CLAUDE.md updated.
- 100% coverage; all gates green.
