# Task 9 — Annotations — `text` / `arrow` / `arrowMarker` / `arrowMarkUp` / `arrowMarkDown`

> **Status: TODO**

## Goal

Port the 5 annotation kinds. Bucket: `labels` for all 5.

## Prerequisites

- Tasks 1–8.

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `text` | `text` | 1 (at) | `at: WorldPoint`, `body: string`, `opts: TextOpts` | `tools/text-tool.ts` | `labels` |
| `arrow` | `arrow` | 2 (from, to) | `from`, `to`, `opts: ArrowOpts` | `tools/arrow-tool.ts` | `labels` |
| `arrow-marker` | `arrowMarker` | 2 (from, to) | `from`, `to`, `opts: ArrowMarkerOpts` | `tools/arrow-marker-tool.ts` | `labels` |
| `arrow-mark-up` | `arrowMarkUp` | 1 (at) | `at: WorldPoint`, `opts: ArrowMarkerOpts` | `tools/arrow-mark-up-tool.ts` | `labels` |
| `arrow-mark-down` | `arrowMarkDown` | 1 (at) | `at: WorldPoint`, `opts: ArrowMarkerOpts` | `tools/arrow-mark-down-tool.ts` | `labels` |

## Distinct Decisions

- **`text.body` MAX_LENGTH = 256.** Pinned in validator (longer
  than the 128 cap for plot labels — text drawings can carry
  short annotations like "Inverse H&S confirmed").
- **`text.opts.bgColor`** — optional fill behind text. Renderer
  measures text width via `ctx.measureText`, fills a padded
  rectangle behind, then renders text.
- **`arrow` vs `arrowMarker`.** `arrow` is a labeled line with a
  triangular arrowhead at `to`; `arrowMarker` is a small dot at
  `from` + line + arrowhead at `to` (matches invinite's
  visual). Same anchor shape, distinct kinds for legacy reasons.
- **`arrowMarkUp` / `arrowMarkDown` are 1-anchor glyphs** —
  green up-chevron / red down-chevron at the given world point.
  Default colors: `"#22c55e"` (up) / `"#ef4444"` (down).
  Useful Pine equivalent: `plotshape(condition, style=shape.triangleup)`.
- **`ArrowOpts.label?: string`** — optional rotated text along
  the arrow shaft. Renderer rotates context by `Math.atan2(...)`
  + `ctx.fillText`.

## Renderer Notes

- `text` — measureText → fillRect background → fillText.
- `arrow` / `arrowMarker` — line + triangular arrowhead (helper
  `drawArrowhead(ctx, from, to, size)` in shared
  `examples/canvas2d-adapter/src/render/draw/arrowhead.ts`).
- `arrowMarkUp` / `arrowMarkDown` — triangle glyph at projected
  anchor (helper `drawChevron(ctx, at, direction, color)`).

## Conformance

5 per-kind scenarios + 1 bundle (`drawAnnotationsAll.scenario.ts`).
The `text` scenario uses `"Inverse Head and Shoulders Confirmed"`
as a representative body (well under the 256-char cap).

## Tests

Per-kind §22.10. Specific:
- `text.property.test.ts` — body length ≤ 256; longer fails
  validation.
- `arrow.property.test.ts` — labeled arrow's `opts.label`
  optional.
- `arrowMarkUp.test.ts` — defaults to green; explicit color
  overrides.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{text,arrow,arrowMarker,arrowMarkUp,arrowMarkDown}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify |
| `packages/core/src/draw/drawingState.ts` | Modify |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (5 validators) |
| `examples/canvas2d-adapter/src/render/draw/{text,arrow,arrowMarker,arrowMarkUp,arrowMarkDown}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/{arrowhead,chevron}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawText,drawArrow,drawArrowMarker,drawArrowMarkUp,drawArrowMarkDown,drawAnnotationsAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{text,arrow,arrow-marker,arrow-mark-up,arrow-mark-down}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-9-annotations.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 5 kinds emit / validate / decode / render / scenario-pass.
- `text.body` length cap enforced.
- Arrow-glyph shared helpers (`arrowhead`, `chevron`) covered
  100%.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–8 gates green.
- Changeset committed.
