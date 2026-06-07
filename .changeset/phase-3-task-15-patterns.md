---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 15 — Harmonic Patterns (`xabcdPattern` / `cypherPattern`
/ `headAndShoulders` / `abcdPattern` / `trianglePattern` /
`threeDrivesPattern`). All 6 kinds map to the `polylines` bucket and
ship as flat methods (`draw.<kind>(...)`) per the Task-11 Option-C
decision.

- **adapter-kit** — 6 new per-kind validators
  (`validateXabcdPatternState`, `validateCypherPatternState`,
  `validateHeadAndShouldersState`, `validateAbcdPatternState`,
  `validateTrianglePatternState`,
  `validateThreeDrivesPatternState`) plus a new
  `validateAnchorHept` helper covering the 7-anchor
  `three-drives-pattern` shape. All 6 validators reuse Task-5's
  `validateLineDrawStyle` and Task-2's per-anchor-arity helpers.
  The permissive-default test fixture moves from `xabcd-pattern`
  → `elliott-impulse-wave` (Task 16's first kind, still unported).
- **runtime** — 6 new emit functions under
  `packages/runtime/src/emit/draw/patterns/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. Each uses the
  3-arg form `(slotId, anchors, opts?)` with the dual-overload
  pattern. Fall-through-stub fixture in `namespace.test.ts` /
  `primitives.test.ts` / `buildComputeContext.test.ts` moves from
  `xabcdPattern` to `elliottImpulseWave`.
- **canvas2d-adapter** — 6 new renderers plus a shared
  `namedPolyline.ts` helper exporting `renderNamedPolyline(ctx,
  points, labels, style)` — strokes an open polyline through the
  pre-projected canvas-space points and fills one text label
  above each anchor (textAlign `center` + textBaseline `bottom`,
  6 px above the anchor). Default colour `#f59e0b` (amber/orange,
  matching invinite's pattern-tool palette family).
  `headAndShoulders` adds a neckline stroke between the two
  trough anchors (`anchors[1]` → `anchors[3]`), totalling 2
  strokes per emission; the other 5 kinds emit 1 polyline stroke
  + N point labels.
- **conformance** — 6 new per-kind scenarios + 1 bundle
  (`drawPatternsAll.scenario.ts` covering all 6 kinds = 6
  emissions). Conformance + scenarios + index test-capability
  fixtures widen `drawings` with
  `capabilities.allPatternDrawings()`. All 7 hashes pinned
  against the deterministic-run actuals.

**Provenance carve-out — `cypherPattern`.** Per the team-lead
brief + PLAN.md §3.1, `cypher-pattern` has no standalone invinite
tool — only the y-doc-bridge type. The runtime emit
(`packages/runtime/src/emit/draw/patterns/cypherPattern.ts`) and
the canvas2d renderer
(`examples/canvas2d-adapter/src/render/draw/cypherPattern.ts`)
both cite **only** `invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
in their relicense headers (no `*-tool.ts` line). The UI surface
for cypher lives in `defineDrawing` (Task 20).

Divergences flagged in
`tasks/phase-3-drawing-parity/15-patterns.plan.md`:

- **`headAndShoulders` is 5-anchor on the landed state** (Task 1's
  `HeadAndShouldersState.anchors: AnchorQuint`), not the 7-anchor
  invinite shape (`start, leftShoulder, leftTrough, head,
  rightTrough, rightShoulder, end`). The renderer treats the 5
  anchors as `[LS, LL, H, RL, RS]` and strokes a neckline between
  the two trough anchors only (no start/end projection). Flagged
  as a Task-1 reshape follow-up.
- **`trianglePattern` is 3-anchor on the landed state**
  (`TrianglePatternState.anchors: AnchorTriple`), not the 4-anchor
  invinite shape (`a, b, c, d`). The renderer treats the 3 anchors
  as `[apex, baseHigh, baseLow]` matching the landed type's
  `@anchors` annotation. Flagged as a Task-1 reshape follow-up.
  Distinct from `draw.triangle` (Task 6), a solid-shape primitive
  with `ShapeStyle` — `draw.trianglePattern` is a harmonic-pattern
  outline with `LineDrawStyle`. JSDoc cross-references the
  distinction.
- `gen-docs` regeneration for the 6 new kinds deferred to Task 21
  (the existing `chartlang docs` command only walks `ta.*`; the
  `draw.*` walker extension is an explicit Task-21 deliverable).
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–14.

See `tasks/phase-3-drawing-parity/15-patterns.plan.md` for the
full audit + divergence list.
