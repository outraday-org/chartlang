---
"@invinite-org/chartlang-adapter-kit": minor
---

Phase-3 Task 2 — adapter-kit drawing surface.

Widens `DrawingKind` from the Phase-1 `"line"` placeholder to the full
61-entry kebab-case union (re-export of
`@invinite-org/chartlang-core`'s `DrawingKind`). Narrows
`DrawingEmission.state` from `unknown` to the typed `DrawingState`
discriminated union. Adapter code that wrote `drawingKind: "line"`
still compiles.

Replaces the Phase-1 unconditional-fail `validateDrawingEmission` with
a per-kind dispatch:

- Unknown `drawingKind` → `unsupported-drawing-kind`.
- Malformed payloads of a known kind → `malformed-emission`.
- The 6 Lines/Rays validators land in this PR (`line`,
  `horizontal-line`, `horizontal-ray`, `vertical-line`,
  `cross-line`, `trend-angle`). Tasks 6–18 ADD their kind
  validators to the dispatch as ports land (per PLAN.md §22.10).
- Validates `handleId` / `op` / `bar` / `time` /
  `state.kind === drawingKind` / `name`/`visible` meta for every
  kind.

Replaces the Phase-1 `decodeDrawing` stub (always returned `null`)
with the real implementation: returns the typed `DrawingState` for
emissions that pass `validateEmission`, `null` otherwise.

Extends `capabilities.*` with the Phase-3 builder set:

- **61 per-kind builders** (`drawLine()`, `drawHorizontalLine()`,
  `drawFibRetracement()`, `drawElliottImpulseWave()`, …) — each
  returns a single-element `ReadonlySet<DrawingKind>` for opt-in
  precision.
- **13 category-group builders** matching PLAN.md §10.2:
  `allLineDrawings()` (6), `allBoxDrawings()` (8),
  `allCurveDrawings()` (3), `allFreehandDrawings()` (3),
  `allAnnotationDrawings()` (5), `allChannelDrawings()` (4),
  `allFibDrawings()` (10), `allGannDrawings()` (4),
  `allPitchforkDrawings()` (2), `allPatternDrawings()` (6),
  `allElliottDrawings()` (5), `allCycleDrawings()` (3),
  `allContainerDrawings()` (2). The 13 categories are pairwise
  disjoint and sum to 61.
- **`allPhase3Drawings()`** — the umbrella set of every kind.
  Adapters that support the full surface (canvas2d in Task 4)
  declare this as their `Capabilities.drawings`.

Re-exports `bucketFor` + `KIND_BUCKET` + `type DrawingBucket` from
core via the adapter-kit barrel. Adapter authors that want to
pre-budget against the canonical kind → bucket map can import them
directly from `@invinite-org/chartlang-adapter-kit`.

No runtime behaviour change — the runtime still doesn't emit
drawings. Phase-2 plot dispatch + meta walker + Phase-1 alert /
diagnostic dispatches are unchanged. 100% coverage on
`packages/adapter-kit` preserved.
