# Task 15 — Harmonic Patterns — `xabcdPattern` / `cypherPattern` / `headAndShoulders` / `abcdPattern` / `trianglePattern` / `threeDrivesPattern`

> **Status: TODO**

## Goal

Port the 6 harmonic / classical pattern kinds. Bucket:
`polylines`. All 6 are multi-leg polyline structures with named
points — patterns render the connecting legs + optional point
labels (X, A, B, C, D, …).

## Prerequisites

- Tasks 1–14.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `xabcd-pattern` | `xabcdPattern` | 5 (x, a, b, c, d) | named points, `style: LineDrawStyle`, optional `name: string` | `tools/xabcd-pattern-tool.ts` | `polylines` |
| `cypher-pattern` | `cypherPattern` | 5 (x, a, b, c, d) | as above; cypher-specific labels | (no standalone tool — `defineDrawing` + `y-doc-bridge.ts` only) | `polylines` |
| `head-and-shoulders` | `headAndShoulders` | 7 (start, leftShoulder, leftTrough, head, rightTrough, rightShoulder, end) | named points, `style` | `tools/head-and-shoulders-tool.ts` | `polylines` |
| `abcd-pattern` | `abcdPattern` | 4 (a, b, c, d) | named points, `style` | `tools/abcd-pattern-tool.ts` | `polylines` |
| `triangle-pattern` | `trianglePattern` | 4 (a, b, c, d) | named points, `style` | `tools/triangle-pattern-tool.ts` | `polylines` |
| `three-drives-pattern` | `threeDrivesPattern` | 7 (start, d1, r1, d2, r2, d3, end) | named points, `style` | `tools/three-drives-pattern-tool.ts` | `polylines` |

## Distinct Decisions

- **`cypher-pattern` has no standalone tool.** Provenance
  header cites only `y-doc-bridge.ts` (no `*-tool.ts`). It is
  emittable from script but historically existed only as a
  `defineDrawing`-driven UI tool — Task 20 (defineDrawing)
  surfaces the UI; Task 15 ships the emit + render.
- **Named anchors via tuple.** State stores anchors as a
  positional tuple (`readonly [x, a, b, c, d]`) — names are
  conventional, not enforced field names. Renderer maps tuple
  index → label via a per-kind label array
  (`["X", "A", "B", "C", "D"]`).
- **`trianglePattern` distinct from `draw.triangle` (Task 6).**
  `draw.triangle` is a 3-anchor solid shape; `triangle-pattern`
  is a 4-anchor harmonic pattern. JSDoc explicitly cross-references.

## Renderer Notes

- All 6 share a `renderNamedPolyline(ctx, points, labels, style,
  view)` helper in `examples/canvas2d-adapter/src/render/draw/
  namedPolyline.ts` — strokes the connecting legs + renders
  each point label.
- `headAndShoulders` additionally strokes the neckline
  (leftTrough → rightTrough projected to viewport edges).
- `threeDrivesPattern` strokes the 6-leg structure (start → d1
  → r1 → d2 → r2 → d3 → end).

## Conformance

6 per-kind scenarios + `drawPatternsAll.scenario.ts`. Each
scenario anchors at known goldenBars timestamps. Hand-picked
points form valid pattern geometry (so visual fidelity is
recognisable in the canvas-rendered golden).

## Tests

- 6 per-kind §22.10 sets.
- `namedPolyline.test.ts` — endpoints + label placement.
- `headAndShoulders.property.test.ts` — neckline always crosses
  the body diagonally (`leftShoulder.price` and
  `rightShoulder.price` lie above the neckline; `head.price`
  also above).

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{xabcdPattern,cypherPattern,headAndShoulders,abcdPattern,trianglePattern,threeDrivesPattern}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (wire into `pattern` sub-namespace) |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (6 validators) |
| `examples/canvas2d-adapter/src/render/draw/{xabcdPattern,cypherPattern,headAndShoulders,abcdPattern,trianglePattern,threeDrivesPattern}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/namedPolyline.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawXabcdPattern,drawCypherPattern,drawHeadAndShoulders,drawAbcdPattern,drawTrianglePattern,drawThreeDrivesPattern,drawPatternsAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{xabcd-pattern,cypher-pattern,head-and-shoulders,abcd-pattern,triangle-pattern,three-drives-pattern}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-15-patterns.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 6 kinds emit / validate / decode / render / scenario-pass.
- `namedPolyline` helper covered 100%.
- `cypherPattern.ts` provenance header cites only
  `y-doc-bridge.ts` (no `*-tool.ts`).
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–14 gates green.
- Changeset committed.
