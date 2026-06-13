# Task 14 — Pitchforks — `pitchfork` (4 variants) / `pitchfan`

> **Status: TODO**

## Goal

Port the 2 pitchfork kinds. `pitchfork` carries a `variant`
discriminator collapsing the 4 invinite tools (standard /
schiff / modifiedSchiff / inside). `pitchfan` is the trident
fan with no variants. Bucket: `polylines`.

## Prerequisites

- Tasks 1–13.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `pitchfork` | `pitchfork` | 3 (a, b, c) + variant | `a`, `b`, `c`, `variant: "standard" \| "schiff" \| "modifiedSchiff" \| "inside"`, `style: LineDrawStyle` | `tools/pitchfork-tool.ts`, `tools/schiff-pitchfork-tool.ts`, `tools/modified-schiff-pitchfork-tool.ts`, `tools/inside-pitchfork-tool.ts` (4 → 1 collapse) | `polylines` |
| `pitchfan` | `pitchfan` | 3 (a, b, c) | `a`, `b`, `c`, `style: LineDrawStyle` | `tools/pitchfan-tool.ts` | `polylines` |

## Distinct Decisions

- **Pitchfork variant collapse — pinned in Task 1.** Task 14
  validates `state.variant ∈ {"standard", "schiff",
  "modifiedSchiff", "inside"}`. Missing variant defaults to
  `"standard"`.
- **Median-line geometry varies per variant.** Standard:
  median line bisects `b` and `c` from `a`. Schiff: midpoint of
  (a, b) becomes the new origin. ModifiedSchiff: midpoint of
  (b, c) becomes the median origin. Inside: median lies inside
  (b, c) range. Each variant pinned in invinite's per-tool file.
- **Provenance header lists all 4 invinite tool files** for the
  `pitchfork` port (per §3.1 multi-file provenance rule).
- **`pitchfan` renders 3 parallel fan rays** from `a` through
  (b, midpoint of (b, c), c).

## Renderer Notes

- `pitchfork` — switch on `state.variant`, compute the median
  origin per variant, draw median line + 2 parallel handle
  lines (through `b` and `c`).
- `pitchfan` — 3 strokes from `a`.

Helper `examples/canvas2d-adapter/src/render/draw/pitchforkGeom.ts`
exports `medianOriginFor(variant, a, b, c): WorldPoint`. Unit
test pins each variant's median origin against known
(a, b, c) triples.

## Conformance

2 per-kind scenarios + `drawPitchforksAll.scenario.ts`. The
pitchfork scenario rotates through all 4 variants (4
`draw.pitchfork(..., { variant: "..." })` calls).

## Tests

- `pitchfork.property.test.ts` — all 4 variants validate;
  unknown variant fails with `malformed-emission`.
- `pitchforkGeom.property.test.ts` — `medianOriginFor`
  finite for any non-degenerate triple.
- Standard §22.10 otherwise.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{pitchfork,pitchfan}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (2 validators; variant enum) |
| `examples/canvas2d-adapter/src/render/draw/{pitchfork,pitchfan}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/pitchforkGeom.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawPitchfork,drawPitchfan,drawPitchforksAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{pitchfork,pitchfan}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-14-pitchforks.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 2 kinds emit / validate / decode / render / scenario-pass.
- All 4 pitchfork variants render distinct median lines (per
  unit test on `medianOriginFor`).
- Provenance header on `pitchfork.ts` lists all 4 invinite tool
  files.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–13 gates green.
- Changeset committed.
