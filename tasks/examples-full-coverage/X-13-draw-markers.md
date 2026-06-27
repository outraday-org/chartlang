# Draw — Markers, Text & Tables

> **Status: TODO**

## Goal

One runnable example per marker / annotation / table `draw.*` kind,
category `draw-markers`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Markers
anchor at a single `bar.point`; `text` takes an anchor + string;
`table` is screen-anchored (rows/cols, not price coords) — mirror its
`docs/primitives/draw/table.md` signature; `group` bundles child
drawings — emit two child kinds and group them.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.marker` | marker | Generic marker at a detected event bar. |
| `draw.arrowMarker` | arrow-marker | Directional arrow marker at a pivot. |
| `draw.arrowMarkUp` | arrow-mark-up | Up-arrow at a swing low (buy signal). |
| `draw.arrowMarkDown` | arrow-mark-down | Down-arrow at a swing high (sell signal). |
| `draw.text` | text | Price/label callout anchored at last bar. |
| `draw.table` | table | Small stats table (last close, RSI) pinned to a corner. |
| `draw.group` | group | Group a line + its text label as one handle. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×7) | Create | One per kind. |
| `examples/catalogue/draw-markers.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×7) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-markers.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind; catalogue + allowlist
  updated; generators re-run; gates green.
