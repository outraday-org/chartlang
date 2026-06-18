# Draw — Elliott Waves

> **Status: TODO**

## Goal

One runnable example per Elliott-wave `draw.*` kind, category
`draw-elliott`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Elliott
kinds take an ordered list of labeled wave points (5-point impulse,
3-point correction, etc.). Build the point list from a sequence of
recent pivots tracked in `state.*` (or fixed `bar.point` offsets if too
few pivots are available in the demo window — the example must still
compile + run clean). Mirror each kind's
`docs/primitives/draw/<kebab>.md` for the exact point count + labels.
`overlay: true`.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.elliottImpulseWave` | elliott-impulse-wave | 5-wave impulse over recent pivots. |
| `draw.elliottCorrectionWave` | elliott-correction-wave | 3-wave (A-B-C) correction. |
| `draw.elliottTriangleWave` | elliott-triangle-wave | Triangle (A-E) correction. |
| `draw.elliottDoubleCombo` | elliott-double-combo | Double-combo (W-X-Y) structure. |
| `draw.elliottTripleCombo` | elliott-triple-combo | Triple-combo (W-X-Y-X-Z) structure. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×5) | Create | One per kind. |
| `examples/catalogue/draw-elliott.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×5) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-elliott.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind with the correct wave
  point count; catalogue + allowlist updated; generators re-run; gates
  green.
