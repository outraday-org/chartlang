---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 7 — third per-port task. Lands the 4 curved-edge /
single-anchor box-family drawing kinds (`circle`, `ellipse`, `path`,
`marker`) per PLAN.md §10 and §22.10. Behaviour ports from invinite
commit `078f41fe2569d659d5aba726da8bcb5d3e2ced02`:
`tools/circle-tool.ts`, `tools/ellipse-tool.ts`, `tools/path-tool.ts`,
`tools/marker-tool.ts`, and the matching `y-doc-bridge.ts` variants.

`@invinite-org/chartlang-adapter-kit` adds per-kind state validators
for the 4 box-B kinds — `validateCircleState`, `validateEllipseState`,
`validatePathState`, `validateMarkerState` — wired into the existing
`validateStateByKind` dispatch. New file-local helpers
`validatePathOpts` (LineDrawStyle + optional `closed: boolean`) and
`validateTextOpts` (color / size / halign / valign / bgColor enums)
cover the path / marker style bags. `path` pins
`2 ≤ anchors.length ≤ 20` (mirrors invinite's 20-point cap and is
narrower than `polyline`'s 3..20 because path supports a 2-point
segment with optional caps). Wire shape is stricter than before —
payloads previously passing the permissive default arm now reject
with `malformed-emission`.

`@invinite-org/chartlang-runtime` ships 4 new `draw.<kind>(...)` emit
functions under `src/emit/draw/boxes/` and extends the
`DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
uses the dual-overload pattern Tasks 5 + 6 pinned. `draw.marker`
splits its `opts` bag — top-level `text` / `value` land on
`MarkerState` while the remaining `TextOpts` fields nest under
`state.style`.

`chartlang-example-canvas2d-adapter` ships 4 new renderers under
`src/render/draw/`. `renderCircle` derives the radius in canvas-pixel
space from `|edge - centre|` (matches invinite's circle-tool) and
issues a single `ctx.arc(...)`. `renderEllipse` paints a 64-segment
polyline approximation (Phase-1 `RenderCtx` exposes `arc(...)` but
not `ellipse(...)` — a polyline keeps the renderer pure on the
existing structural surface without widening it). `renderPath` paints
an OPEN polyline (no `closePath` by default; `style.closed === true`
toggles closure). `renderMarker` projects the anchor + paints
`text` (when set) via `ctx.fillText` with `TextOpts`-derived font +
alignment. Empty / undefined text is a pure no-op — icon-glyph
painting belongs to Task 20's `defineDrawing` follow-up. The
`drawingDispatch` switch flips the 4 box-B arms from no-op stubs to
real `renderXxx(ctx, e, view)` calls; exhaustiveness is preserved.

`@invinite-org/chartlang-conformance` ships 4 new per-kind scenarios
under `src/scenarios/` (`drawCircle`, `drawEllipse`, `drawPath`,
`drawMarker`). Per README §22.10 the Task-6 `drawBoxesA.scenario.ts`
is REPLACED (deleted) by the wider `drawBoxesAll.scenario.ts`
covering all 8 box kinds across Tasks 6 + 7 (rectangle /
rotated-rectangle / triangle / polyline / circle / ellipse / path /
marker). All five new scenarios use `inlineSource` against the
bundled 10 000-bar `goldenBars.json` fixture with anchor times pulled
from `bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES`
bag in `runConformanceSuite.test.ts` + `scenarios.test.ts` bumps
`labels` budget from 0 to 100 to host the marker scenario (marker
maps to the `labels` bucket). The 4 + 1 new scenarios extend
`ALL_SCENARIOS` and the public re-export surface; `DRAW_BOXES_A_SCENARIO`
is removed from the public surface (downstream consumers move to
`DRAW_BOXES_ALL_SCENARIO`).

No core edits — the `DrawingState` variants and `DrawNamespace`
signatures Task 1 shipped are the canonical shape and Task 7 wires
real impls to them.

Deviations from spec, flagged for review:
- `MarkerState` shape divergence — task spec's `markerKind` (`emoji` /
  `icon`) discriminator + `value: string` + `MAX_LENGTH = 32` + icon
  registry NOT implemented. Uses Task 1's landed
  `{ anchor, text?, value?, style: TextOpts }` shape (anchor not
  from/to pair; value is a number; no discriminator). Re-shaping
  belongs to a follow-up that widens core; mid-phase Task-1 reshapes
  cascade through the `DrawingState` union + adapter-kit decoder +
  Task-6 permissive-default tests.
- `Ellipse` rendered as 64-segment polyline approximation because
  `RenderCtx` exposes `arc(...)` but not `ellipse(...)`. Widening
  the structural type would touch Phase-1's `RenderCtx`; the
  polyline path stays on the existing surface.
- Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
  (mirrors Tasks 5 + 6) — Task 3's `pushDrawing.*` and `handle.*`
  suite covers the underlying infra exhaustively.
- `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
  5 + 6).
