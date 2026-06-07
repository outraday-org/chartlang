---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": patch
---

Phase-3 Task 1 — `draw.*` type surface foundation.

Adds the canonical Phase-3 type surface to `@invinite-org/chartlang-core`:

- `DrawingKind` — 61-entry kebab-case discriminated union (lines /
  boxes / curves / freehand / annotations / channels / fib / gann /
  pitchforks / patterns / elliott / cycles / containers). The
  kebab-case wire format is the source-of-truth; the camelCase
  TypeScript surface (`draw.horizontalLine`, `draw.fibRetracement`,
  …) is pinned via the `KIND_CAMELCASE` / `KIND_KEBABCASE` bijection.
- `DRAWING_KINDS` — iterable form of `DrawingKind` in canonical
  declaration order.
- `WorldPoint` + `AnchorPair` / `AnchorTriple` / `AnchorQuad` /
  `AnchorQuint` / `AnchorHept` helpers.
- `DrawingState` — discriminated union with one variant per kind.
  Geometry + style fields only; collab-only fields (Yjs ids,
  layerIds, intervals, parentGroupId/FrameId, createdAt, authorId)
  from the invinite source are stripped per PLAN.md §10.4. Variants
  are minimal shells in this task; Tasks 5–18 refine per-category
  payloads.
- Per-kind style bag types: `LineDrawStyle`, `ShapeStyle`,
  `HighlighterStyle`, `BrushStyle`, `TextOpts`, `ArrowOpts`,
  `ArrowMarkerOpts`, `PathOpts`, `FibOpts`, `RegressionTrendOpts`,
  `FrameOpts`.
- `DrawingHandle` — script-facing handle returned by every
  `draw.<kind>(...)` call. Impl lives in the runtime (Task 3).
- `DrawNamespace` + `FibSubNamespace` / `GannSubNamespace` /
  `ElliottSubNamespace` / `PatternSubNamespace` — the type the
  runtime swaps the throwing-stub `draw` Proxy for at boot. The
  stub mirrors the `plot` / `hline` / `alert` pattern from
  `plot/plot.ts`.
- `DrawingBucket` + `KIND_BUCKET` + `bucketFor(kind)` — canonical
  kind → bucket map (`lines` / `labels` / `boxes` / `polylines` /
  `other`). Consumed by the runtime budget enforcer (Task 3) and
  by adapters that pre-budget.
- `DrawingCounts` — moved here from `@invinite-org/chartlang-adapter-kit`
  so `ScriptManifest.maxDrawings?: DrawingCounts` and
  `Capabilities.maxDrawingsPerScript` pin the same shape without
  introducing a `core → adapter-kit` dependency cycle. The
  `adapter-kit` `DrawingCounts` export is now a type re-export of
  the core declaration — no public-surface drift, no consumer-visible
  change.
- `ScriptManifest.maxDrawings?: DrawingCounts` + matching
  `DefineIndicatorOpts.maxDrawings?: DrawingCounts` propagation.

Extends `STATEFUL_PRIMITIVES` by 61 `draw.<camelKind>` entries (all
`slot: true`). Cardinality grows from **93 → 154**. The new entries
follow the canonical `DRAWING_KINDS` order. The compiler's
`callsiteIdInjection` + `statefulCallInLoop` passes pick them up by
name automatically.

No runtime behavior change in this task — `draw` is a throwing-stub
Proxy until Task 3 wires the runtime emit infra. Phase-3 downstream
tasks (2–22) all import from this surface.
