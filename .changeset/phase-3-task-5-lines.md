---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 5 — first per-port task. Lands the 6 line-family drawing
kinds (`line`, `horizontalLine`, `horizontalRay`, `verticalLine`,
`crossLine`, `trendAngle`) per PLAN.md §10 and §22.10.

`@invinite-org/chartlang-runtime` ships 6 new `draw.<kind>(...)` emit
functions under `src/emit/draw/lines/` plus the `DRAW_NAMESPACE` swap
seam at `src/emit/draw/namespace.ts` — the namespace re-exports core's
throwing-stub Proxy for the 55 kinds that haven't shipped yet and
routes the 6 line kinds through their runtime impls. Each impl uses
the dual-overload pattern (`(a, b, opts?)` script-facing throw +
`(slotId, a, b, opts?)` compiler-injected) mirroring `plot` / `alert`.
Returns a `DrawingHandle` per PLAN.md §10.3; subsequent in-bar
`update(patch)` calls merge into the slot's state and re-emit the
full payload.

`@invinite-org/chartlang-compiler` widens the core ambient shim
(`program.ts`) with `WorldPoint`, `LineDrawStyle`, `DrawingHandle`,
`DrawNamespace` declarations + `export const draw: DrawNamespace` so
the callsite-id transformer recognises `draw.<kind>(...)` calls and
injects the slot id (entries already shipped in `STATEFUL_PRIMITIVES`
via Task 1).

`chartlang-example-canvas2d-adapter` ships 6 new renderers under
`src/render/draw/` — `line.ts`, `horizontalLine.ts`,
`horizontalRay.ts`, `verticalLine.ts`, `crossLine.ts`,
`trendAngle.ts` — plus the shared `extendLineSegment` helper that
projects a segment to the viewport edges (consumed by `line` when its
`extendLeft`/`extendRight` flags are set, and by `horizontalRay`
which always extends right). The `drawingDispatch` switch arms for
the 6 line kinds flip from no-op stubs to real-impl calls; the
exhaustive `satisfies never` default and `op: "remove"` short-circuit
are unaffected. The `trendAngle` renderer additionally draws a small
arc + angle text at the `from` anchor, mirroring the invinite tool's
`paintTrendAngleArc`.

`@invinite-org/chartlang-conformance` lands 7 new bundled scenarios:
6 per-kind (`DRAW_LINE_SCENARIO`, `DRAW_HORIZONTAL_LINE_SCENARIO`,
`DRAW_HORIZONTAL_RAY_SCENARIO`, `DRAW_VERTICAL_LINE_SCENARIO`,
`DRAW_CROSS_LINE_SCENARIO`, `DRAW_TREND_ANGLE_SCENARIO`) plus one
category bundle (`DRAW_LINES_AND_RAYS_SCENARIO`). Each uses
`inlineSource` and pins one `drawing-hash` assertion + asserts
`unsupported-drawing-kind` and `drawing-budget-exceeded` are absent.
The `TEST_CAPABILITIES` bag in the conformance test suite widens
`drawings` to `capabilities.allLineDrawings()` and lifts the `lines`
bucket budget from `0` to `100` so the new scenarios reach
`pushDrawing`'s happy path. All 7 scenarios pass against the
canvas2d default adapter (which already declared
`drawings: capabilities.allPhase3Drawings()` via Task 4).

All Phase-1 / Phase-2 / Tasks-1–4 gates remain green. 100% coverage
maintained across `runtime`, `canvas2d-adapter`, and `conformance`.
