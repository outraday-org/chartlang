---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"chartlang-example-canvas2d-adapter": minor
---

Phase-3 Task 9 — fifth per-port task. Lands the 5 annotation drawing
kinds (`text`, `arrow`, `arrowMarker`, `arrowMarkUp`, `arrowMarkDown`)
per PLAN.md §10 and §22.10. Behaviour ports from invinite commit
`078f41fe2569d659d5aba726da8bcb5d3e2ced02`: `tools/text-tool.ts`,
`tools/arrow-tool.ts`, `tools/arrow-marker-tool.ts`,
`tools/arrow-mark-up-tool.ts`, `tools/arrow-mark-down-tool.ts`, and the
matching `y-doc-bridge.ts` variants (`TextDrawing`, `ArrowDrawing`,
`ArrowMarkerDrawing`, `ArrowMarkUpDrawing`, `ArrowMarkDownDrawing`).
All 5 kinds map to the `labels` bucket.

`@invinite-org/chartlang-adapter-kit` adds per-kind state validators
for the 5 annotation kinds — `validateTextState`, `validateArrowState`,
`validateArrowMarkerState`, `validateArrowMarkUpState`,
`validateArrowMarkDownState` — wired into the existing
`validateStateByKind` dispatch. Two new file-local style helpers land
alongside: `validateArrowOpts` (`LineDrawStyle` + optional string
`label`) and `validateArrowMarkerOpts` (optional `color` + optional
`text`). `text.body` is validated through `walkMeta` (catches
non-JsonValue payloads like bigint / function / symbol) and then
pinned as a non-empty string with `TEXT_BODY_MAX_LENGTH = 256` (longer
than the 128 cap on plot labels — annotation strings carry short
rationales like "Inverse Head and Shoulders Confirmed"). Wire shape
is stricter than before — payloads previously passing the permissive
default arm now reject with `malformed-emission`.

`@invinite-org/chartlang-runtime` ships 5 new `draw.<kind>(...)` emit
functions under `src/emit/draw/annotations/` and extends the
`DRAW_NAMESPACE` swap-seam at `src/emit/draw/namespace.ts`. Each impl
uses the dual-overload pattern Tasks 5–8 pinned. `draw.text` is the
first emit fn with three script-facing arguments (`anchor`, `body`,
`opts?`); the compiler-injected form is `(slotId, anchor, body,
opts?)` and the impl signature carries four arguments.

`chartlang-example-canvas2d-adapter` ships 5 new renderers under
`src/render/draw/` plus three new shared helpers: `arrowhead.ts`
(`drawArrowhead(ctx, from, to, size?)` — filled triangular arrowhead
at `to` pointing along the shaft direction; used by `arrow` +
`arrowMarker`), `chevron.ts` (`drawChevron(ctx, at, direction, color,
baseWidth?, height?)` — filled up/down triangle glyph; used by
`arrowMarkUp` + `arrowMarkDown`), and `textStyle.ts` (`SIZE_TO_PX` /
`HALIGN_TO_TEXTALIGN` / `VALIGN_TO_TEXTBASELINE` maps +
`resolveTextOpts(opts)` helper that turns a `TextOpts` bag into the
four canvas text-state values). The Task-7 `marker.ts` renderer is
refactored to consume `textStyle.ts` for the same maps — its call
sequence is preserved exactly so `marker.test.ts` continues to pass
unchanged. Default colours follow invinite's paint-time defaults:
`#3b82f6` (toolbar blue) for `arrowMarker`, `#22c55e` (green) for
`arrowMarkUp`, `#ef4444` (red) for `arrowMarkDown`. The `drawingDispatch`
switch flips the 5 arms from no-op stubs to real `renderXxx(ctx, e,
view)` calls; exhaustiveness is preserved.

`@invinite-org/chartlang-conformance` ships 5 new per-kind scenarios
under `src/scenarios/` (`drawText`, `drawArrow`, `drawArrowMarker`,
`drawArrowMarkUp`, `drawArrowMarkDown`) plus one bundle scenario
`drawAnnotationsAll` that emits one drawing per annotation kind on
the first bar (per README §22.10 Task 9 collapses the category into
ONE bundle). All six scenarios use `inlineSource` against the bundled
10 000-bar `goldenBars.json` fixture with anchor times pulled from
`bars[0]` / `bars[500]` / `bars[1000]`. The `TEST_CAPABILITIES` bags
in `runConformanceSuite.test.ts` + `scenarios/scenarios.test.ts`
extend the `drawings` set with `allAnnotationDrawings()`; the existing
`labels: 100` bucket budget (added when Task 7's `marker` scenario
landed) covers the bundle scenarios with headroom. `ALL_SCENARIOS`
extends additively.

No core edits — the `DrawingState` variants and `DrawNamespace`
signatures Task 1 shipped are the canonical shape and Task 9 wires
real impls to them.

Deviations from spec, flagged for review:
- `text.bgColor` background-rectangle paint NOT rendered. The
  structural `RenderCtx` exposes neither `measureText` nor a
  background-rect path; widening would touch the Phase-1 structural
  type. The `bgColor` field is preserved on the wire (validator
  accepts string) but the canvas2d renderer does not paint a
  background rect. Mirror Task 7's `marker` precedent.
- `ArrowOpts.label` rotation NOT rendered. `RenderCtx` has no
  `rotate / translate / save / restore`. Label paints un-rotated at
  the shaft midpoint with `textAlign = "center"` /
  `textBaseline = "bottom"`. Pure on the Phase-1 surface.
- `ArrowMarkerState` ↔ spec shape delta. Task 1's core landed
  `ArrowMarkerState` with single `anchor: WorldPoint`; the spec
  README §13 says `2 (from, to)`. Per Tasks 6/7's "don't reshape
  Task-1 mid-phase" precedent, Task 9 uses the single-anchor form
  and the renderer paints a self-contained glyph (dot + stub line +
  arrowhead + optional text) at the anchor — a "annotation lives
  here" marker that fits in ~24px. Reshape can ship in a follow-up.
- `marker.ts` refactor crosses Task 7 boundary by ~5 lines to
  consume the new shared `textStyle.ts` helper. The call sequence is
  preserved exactly; `marker.test.ts` continues to pass without
  modifications.
- Per-kind §22.10 5-file test set deferred to pragmatic 1-file set
  (mirrors Tasks 5–8) — Task 3's `pushDrawing.*` and `handle.*`
  suite covers the underlying infra exhaustively.
- `gen-docs` doc-page generation deferred to Task 21 (mirrors Tasks
  5–8).
