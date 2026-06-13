# Task 16 — Elliott Waves — `elliottImpulseWave` / `elliottCorrectionWave` / `elliottTriangleWave` / `elliottDoubleCombo` / `elliottTripleCombo`

> **Status: TODO**

## Goal

Port the 5 Elliott wave drawing kinds. Bucket: `polylines`. All
5 are variable-length polylines with kind-specific label arrays.

## Prerequisites

- Tasks 1–15 (reuses `namedPolyline.ts` from Task 15).

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source | Bucket |
|---|---|---|---|---|---|
| `elliott-impulse-wave` | `elliottImpulseWave` | 6 (points[6]) | `points: ReadonlyArray<WorldPoint>` (length pinned 6), `degree: WaveDegree`, `style: LineDrawStyle` | `tools/elliott-impulse-wave-tool.ts` | `polylines` |
| `elliott-correction-wave` | `elliottCorrectionWave` | 4 (points[4]) | `points` (length pinned 4), `degree`, `style` | `tools/elliott-correction-wave-tool.ts` | `polylines` |
| `elliott-triangle-wave` | `elliottTriangleWave` | 6 (points[6]) | `points` (length pinned 6), `degree`, `style` | `tools/elliott-triangle-wave-tool.ts` | `polylines` |
| `elliott-double-combo` | `elliottDoubleCombo` | 7 (points[7]) | `points` (length pinned 7), `degree`, `style` | `tools/elliott-double-combo-tool.ts` | `polylines` |
| `elliott-triple-combo` | `elliottTripleCombo` | 10 (points[10]) | `points` (length pinned 10), `degree`, `style` | `tools/elliott-triple-combo-tool.ts` | `polylines` |

## Distinct Decisions

- **`WaveDegree` enum.** Declared in
  `packages/core/src/draw/drawingState.ts` as:

  ```ts
  export type WaveDegree =
      | "subMinuette" | "minuette" | "minute" | "minor"
      | "intermediate" | "primary" | "cycle" | "supercycle" | "grandSupercycle";
  ```

  Default: `"primary"`. Renderer uses degree for label
  decoration (Roman vs Arabic, brackets vs parentheses) per
  Elliott convention.
- **Label arrays** — per kind:
  - Impulse: `["i", "ii", "iii", "iv", "v"]` (5 inner labels —
    6 points define 5 legs).
  - Correction: `["a", "b", "c"]`.
  - Triangle: `["a", "b", "c", "d", "e"]`.
  - Double combo: `["w", "x", "y"]` with intermediate sub-labels.
  - Triple combo: `["w", "x", "y", "x", "z"]`.
- **`points.length` strictly pinned per kind.** Validator fails
  with `malformed-emission` on any other length (NOT a range —
  exact match required).

## Renderer Notes

- Reuses `namedPolyline.ts` from Task 15 with kind-specific
  label arrays.
- Renderer additionally decorates the labels per
  `state.degree` (e.g. uppercase Roman for "primary",
  lowercase Roman for "subMinuette") — helper
  `examples/canvas2d-adapter/src/render/draw/elliottLabels.ts`.

## Conformance

5 per-kind scenarios + `drawElliottAll.scenario.ts`. Each
scenario picks `degree: "primary"` for determinism.

## Tests

- 5 per-kind §22.10.
- `elliottImpulseWave.property.test.ts` — `points.length === 6`
  exact; 5 or 7 fails validation.
- `elliottLabels.test.ts` — degree → label-style mapping
  exhaustive over `WaveDegree`.

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/runtime/src/emit/draw/{elliottImpulseWave,elliottCorrectionWave,elliottTriangleWave,elliottDoubleCombo,elliottTripleCombo}.ts` + 5 test files each | Create |
| `packages/runtime/src/emit/draw/index.ts` | Modify (wire into `elliott` sub-namespace) |
| `packages/core/src/draw/drawingState.ts` | Modify (add `WaveDegree`) |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify (5 validators) |
| `examples/canvas2d-adapter/src/render/draw/{elliottImpulseWave,elliottCorrectionWave,elliottTriangleWave,elliottDoubleCombo,elliottTripleCombo}.ts` + tests | Create |
| `examples/canvas2d-adapter/src/render/draw/elliottLabels.ts` + test | Create |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify |
| `packages/conformance/src/scenarios/{drawElliottImpulseWave,drawElliottCorrectionWave,drawElliottTriangleWave,drawElliottDoubleCombo,drawElliottTripleCombo,drawElliottAll}.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `docs/primitives/draw/{elliott-impulse-wave,elliott-correction-wave,elliott-triangle-wave,elliott-double-combo,elliott-triple-combo}.md` | Create (auto-gen) |
| `.changeset/phase-3-task-16-elliott.md` | Create |

## Gates

Standard set.

## Changeset

Minor on runtime, core, adapter-kit, canvas2d, conformance.

## Acceptance Criteria

- 5 kinds emit / validate / decode / render / scenario-pass.
- `WaveDegree` enum exhaustive over the 9 levels.
- Each kind's `points.length` exact-pinned.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–15 gates green.
- Changeset committed.
