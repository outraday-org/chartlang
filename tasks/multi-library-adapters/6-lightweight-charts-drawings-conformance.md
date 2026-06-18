# lightweight-charts adapter: drawings + conformance

> **Status: TODO**

## Goal

Complete the lightweight-charts adapter: render all 62 drawing kinds via a
lightweight-charts **Series Primitive** that paints
`decomposeDrawing(emission, viewport)` to the primitive's
`CanvasRenderingContext2D` using `paintPrimitive`, with the `Viewport`
built from LC's `priceToCoordinate`/`timeToCoordinate`. Add the hashed
integration test, wire conformance, and ship the README + docs.

## Prerequisites

- Task 5 (lightweight-charts scaffold + series).
- Tasks 1–3 (`decomposeDrawing` + `paintPrimitive` + canvas sink).

## Current Behavior

After Task 5 the adapter renders candles/plots/panes but buffers drawings
without painting them.

## Desired Behavior

Drawings paint as a series primitive overlay; the adapter is full-surface
and conformance-green.

## Requirements

### 1. Drawing primitive — `src/drawingPrimitive.ts`

Implement an `ISeriesPrimitive` (lightweight-charts plugin API) whose
pane-view renderer draws every buffered `DrawingEmission`:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";
import { paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

// inside the renderer's draw(target):
target.useBitmapCoordinateSpace((scope) => {
    const ctx = scope.context;                 // CanvasRenderingContext2D ⊇ RenderCtx
    const view = buildViewport(series, timeScale, scope); // see §2
    for (const d of drawings.values()) {
        if (d.op === "remove") continue;
        for (const prim of decomposeDrawing(d, view)) paintPrimitive(ctx, prim);
    }
});
```

Register the primitive via `series.attachPrimitive(...)` in the factory
(Task 5's factory gains the attach call).

### 2. Viewport from LC converters — `src/viewport.ts`

`buildViewport(series, timeScale, scope): Viewport` — the adapter's
`Viewport` (adapter-kit IR) is defined in **world** units (time, price)
with `pxWidth`/`pxHeight`. But `paintPrimitive` consumes **pixel**
`DrawPrimitive`s already projected by `decomposeDrawing` using
`timeToX`/`priceToY` over `Viewport`. Two options — pick and document:

- **(A) Synthesise a linear `Viewport`** whose `xMin/xMax`/`yMin/yMax` and
  `pxWidth/pxHeight` reproduce LC's visible range, so adapter-kit's linear
  `timeToX`/`priceToY` match LC's coordinates. Works only if LC's price
  scale is linear in the visible window.
- **(B) Recommended:** add an optional **projector override** to
  `decomposeDrawing`. Extend the adapter-kit signature (Task 1) is
  undesirable post-hoc; instead expose a thin
  `projectPrimitives(prims, project)` helper, OR have `decomposeDrawing`
  accept a `Viewport` produced from a non-linear projector. **Decision:**
  keep `decomposeDrawing(emission, view)` pure-linear, and for LC build
  the `Viewport` from `timeScale.timeToCoordinate` + `series.priceToCoordinate`
  sampled at the visible extremes, accepting linear-price approximation
  (LC default price scale is linear). Document the approximation; log-scale
  price axes are a deferred follow-up.

> If linear approximation proves visibly wrong in tests, prefer adding a
> `project?: (p: WorldPoint) => Point2` parameter to `decomposeDrawing` in
> adapter-kit (a small, backward-compatible enhancement) and thread LC's
> converters through — record this as the fallback in the task notes.

### 3. Integration test — `src/integration.test.ts`

Mirror `examples/canvas2d-adapter/src/integration.test.ts`: compile an
inline indicator that emits plots **and** drawings (e.g. an EMA line plus
`draw.line`/`draw.rectangle`/`draw.fibRetracement`), drive it through the
factory with the `MockLwcApi` chart seam **and** a `MockCanvasContext`
(from `@invinite-org/chartlang-adapter-kit/canvas`) for the primitive's
`ctx`, and pin a `hashCallLog` constant over the painted drawing calls.

### 4. Conformance test — `src/conformance.test.ts`

```ts
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import defaultAdapter from "./index.js";
// expect report.failed === 0
```

(Conformance reads `capabilities` only — this asserts the full-surface
capability declaration is internally consistent.)

### 5. README + docs

- `README.md` (≤ 100 lines): purpose, install, public surface
  (`createLightweightChartsAdapter`, `LWC_CAPABILITIES`, default export),
  native-vs-primitive rendering note, license.
- **Update the existing `docs/adapters/reference/lightweight-charts.md`**
  (it currently says "does not add a Lightweight Charts adapter package to
  this repository" — that's now false). Rewrite it as the real adapter
  guide: the v5 `addSeries` native mapping, the series-primitive drawing
  path, and the linear-price caveat. Per-library pages live under
  `docs/adapters/reference/` (the established vitepress convention; Task 13
  wires the nav). Do **not** create a duplicate top-level
  `docs/adapters/lightweight-charts.md`.

### Edge cases

- `op: "remove"` skipped; removed drawings vanish next frame (primitive
  re-reads the buffer).
- NaN/extrapolated `bar.point` anchors → NaN pixels → LC/ctx no-op (no throw).
- Drawing on a sub-pane vs overlay: the primitive attaches to the overlay
  series; pane-scoped drawings render against the overlay viewport (match
  canvas2d's overlay-tail behaviour).
- Visible-range changes (scroll/zoom) re-invoke the renderer with a fresh
  viewport — buffered state is the single source of truth.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.../src/drawingPrimitive.ts` (+test) | Create | `ISeriesPrimitive` painting `decomposeDrawing` |
| `.../src/viewport.ts` (+test) | Create | `Viewport` from LC converters |
| `.../src/createLightweightChartsAdapter.ts` | Modify | attach primitive; ingest drawings |
| `.../src/integration.test.ts` | Create | hashed plots+drawings integration |
| `.../src/conformance.test.ts` | Create | `runConformanceSuite` green |
| `.../README.md` | Modify | full surface docs |
| `docs/adapters/reference/lightweight-charts.md` | Modify | rewrite existing contract walkthrough as the real adapter guide |
| `examples/lightweight-charts-adapter/CLAUDE.md` | Modify | drawings via series primitive; viewport caveat |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm conformance`
- `pnpm docs:check` / `pnpm readme:check`

## Changeset

Private example → no public changeset (or patch if the repo changesets
privates). No adapter-kit change unless the §2 `project?` fallback is taken
(then adapter-kit gets a **minor** + its own changeset).

## Acceptance Criteria

- All 62 drawing kinds paint via the series primitive +
  `decomposeDrawing`/`paintPrimitive`; hashed integration test pinned.
- `runConformanceSuite(default)` reports `failed === 0`.
- README ≤ 100 lines; docs page added; CLAUDE.md updated.
- 100% coverage; all gates green.
