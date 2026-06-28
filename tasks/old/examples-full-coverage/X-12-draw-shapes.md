# Draw — Shapes & Freehand

> **Status: TODO**

## Goal

One runnable example per shape / freehand `draw.*` kind, category
`draw-shapes`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md) (anchors via
`bar.point` / tracked state; reuse one handle; mirror each kind's
`docs/primitives/draw/<kebab>.md` anchor shape; `overlay: true`).
Freehand kinds (`brush`, `pen`, `highlighter`, `curve`) take a point
list — build a small fixed-length array of `bar.point` anchors.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.circle` | circle | Circle centered on a pivot. |
| `draw.ellipse` | ellipse | Ellipse bounding a consolidation range. |
| `draw.arc` | arc | Arc between two swing points. |
| `draw.rectangle` | rectangle | Range box over a recent N-bar window. |
| `draw.rotatedRectangle` | rotated-rectangle | Tilted range box along a trend. |
| `draw.triangle` | triangle | Triangle over three pivots. |
| `draw.frame` | frame | Framed region highlight. |
| `draw.curve` | curve | Smooth curve through anchors. |
| `draw.doubleCurve` | double-curve | Double-curve (S-shape) between points. |
| `draw.brush` | brush | Freehand brush stroke over a point list. |
| `draw.pen` | pen | Pen stroke over a point list. |
| `draw.highlighter` | highlighter | Highlighter band over a price zone. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×12) | Create | One per kind. |
| `examples/catalogue/draw-shapes.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×12) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-shapes.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind; catalogue + allowlist
  updated; generators re-run; gates green.
