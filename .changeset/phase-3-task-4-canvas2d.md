---
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 4 — canvas2d shared drawing-render scaffolding.

New `examples/canvas2d-adapter/src/render/draw/` subtree:

- `worldPointToCanvas(p, view)` — projects a world `(time, price)`
  `WorldPoint` to canvas `(x, y)` pixels by composing the existing
  `timeToX` + `priceToY` helpers. The canonical projector every
  Phase-3 drawing renderer (Tasks 5–18) consumes; off-screen points
  are returned as finite out-of-range pixels (no clipping) so the
  canvas2d context's own stroke/fill clipping is the only boundary.
- `drawingDispatch(ctx, emission, view)` — single switch over the
  61-entry `DrawingKind` union with `_exhaustive: never` default
  arm. Task 4 ships no-op stubs for every kind; per-kind tasks 5–18
  swap their arm with a real renderer one PR at a time. `op:
  "remove"` short-circuits.
- `FIB_LEVELS: ReadonlyArray<number>` + `formatLevel(level)` —
  canonical Fibonacci ratios (`0, 0.236, 0.382, 0.5, 0.618, 0.786,
  1, 1.272, 1.414, 1.618, 2.0, 2.618, 4.236`) + Pine-style label
  formatter. Consumed by every fib renderer in Tasks 11–12.
- `quadraticBezier` / `cubicBezier` + `sampleQuadratic` /
  `sampleCubic` + `Point2` — pure curve helpers consumed by `arc`
  / `curve` / `doubleCurve` (Task 8), `fibSpiral` (Task 12), and
  pattern-leg projections (Task 15). Endpoints are float-exact.

`CANVAS2D_CAPABILITIES.drawings` widens from `new Set()` to
`capabilities.allPhase3Drawings()` so the conformance suite covers
every kind end-to-end. `maxDrawingsPerScript` widens from
zero-budget to `{ lines: 200, labels: 200, boxes: 100, polylines:
100, other: 100 }` — sized so the Phase-3 `drawAll61` smoke
scenario (Task 19) fits without exhausting any bucket.

`createCanvas2dAdapter`'s `ingest` accumulates `DrawingEmission`s
into `state.drawings` keyed by `handleId` (last-write-wins; `op:
"remove"` drops the key); `renderFrame` walks the map through
`drawingDispatch` against the computed `Viewport` so per-kind
renderers ship to a live render pipeline as Tasks 5–18 land.

`DEFAULT_ADAPTER` (the headless capability surface consumed by the
conformance harness) stays a no-op for `onEmissions` — it owns no
`RenderCtx` and never has. The live render path is
`createCanvas2dAdapter`.

The `render/` barrel re-exports the new helpers + `Point2` so
per-kind renderers in Tasks 5–18 can `import { worldPointToCanvas,
drawingDispatch, ... } from "../"` without reaching into
`render/draw/` directly.

No behaviour change for Phase-1/-2 scenarios — every per-kind
dispatch arm is a no-op until its port task lands.
