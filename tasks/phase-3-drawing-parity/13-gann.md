# Task 13 — Gann — `gannBox` / `gannSquareFixed` / `gannSquare` / `gannFan`

> **Status: TODO**

## Goal

Port the 4 Gann drawing kinds. Bucket: `other` for all 4.

## Prerequisites

- Tasks 1–12.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `gann-box` | `gannBox` | 2 (from, to) + levels | `from`, `to`, `levels: ReadonlyArray<number>` (default Gann subdivisions), `style: LineDrawStyle` | `tools/gann-box-tool.ts` | `other` |
| `gann-square-fixed` | `gannSquareFixed` | 2 (origin, size) | `origin: WorldPoint`, `sizePrice: Price`, `style: LineDrawStyle` | `tools/gann-square-fixed-tool.ts` | `other` |
| `gann-square` | `gannSquare` | 2 (from, to) + ratio | `from`, `to`, `ratio: number` (default 1.0 = 1 price unit per bar), `style: LineDrawStyle` | `tools/gann-square-tool.ts` | `other` |
| `gann-fan` | `gannFan` | 2 (from, to) | `from`, `to`, `style: LineDrawStyle` (renders 8 fan rays at Gann angles 1×1, 1×2, 1×3, 2×1, 3×1, 1×4, 1×8, 8×1) | `tools/gann-fan-tool.ts` | `other` |

## Distinct Decisions

- **Gann levels default array.** `gannBox.levels` defaults to
  `[0, 0.25, 0.5, 0.75, 1.0]` (Gann's standard 1/4 subdivisions).
  Shared constant `GANN_LEVELS` in
  `examples/canvas2d-adapter/src/render/draw/gannLevels.ts`.
- **`gannSquareFixed.sizePrice`** is the side length in price
  units — `(time_span, price_span)` are both derived from
  `sizePrice` via the renderer's `ratio` mapping (1 price unit
  = 1 bar by default for Gann-1×1).
- **`gannSquare.ratio`** explicit — overrides the 1×1 default.
  Validator pins `ratio > 0`.
- **`gannFan` renders 8 rays** at fixed Gann angles (1×1, 1×2,
  1×3, 2×1, 3×1, 1×4, 1×8, 8×1) from `from`. Labels: `"1x1"`,
  `"1x2"`, etc. (rendered text at the right edge of each ray).

## Renderer Notes

- `gannBox` — outer rectangle stroke + horizontal/vertical
  internal lines at level fractions.
- `gannSquareFixed` — `strokeRect(originX, originY, sizePx,
  sizePx)`.
- `gannSquare` — like `gannSquareFixed` but with explicit
  `ratio` controlling the price-per-bar scaling.
- `gannFan` — 8 strokes at Gann angles, rendered to viewport
  edges.

## Conformance

4 per-kind scenarios + `drawGannAll.scenario.ts`.

## Tests

- `gannSquare.property.test.ts` — `ratio > 0` enforced; ratio
  ≤ 0 fails validation.
- Other kinds standard §22.10.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{gannBox,gannSquareFixed,gannSquare,gannFan}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (wire into `gann` sub-namespace) |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (4 validators) |
| `examples/canvas2d-adapter/src/render/draw/{gannBox,gannSquareFixed,gannSquare,gannFan}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/gannLevels.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawGannBox,drawGannSquareFixed,drawGannSquare,drawGannFan,drawGannAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{gann-box,gann-square-fixed,gann-square,gann-fan}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-13-gann.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 4 kinds emit / validate / decode / render / scenario-pass.
- `GANN_LEVELS` constant pinned in one place; consumed by
  `gannBox` renderer.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–12 gates green.
- Changeset committed.
