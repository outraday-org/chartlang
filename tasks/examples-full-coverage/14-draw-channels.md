# Draw — Channels, Regression & Cycles

> **Status: TODO**

## Goal

One runnable example per channel / regression / cycle `draw.*` kind,
category `draw-channels`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Channels
and pitchforks take 2–3 anchor points (parallel/median construction);
regression-trend fits a line over a range; cycle kinds take a base
anchor + period. Derive anchors from recent pivots / fixed offsets via
`bar.point`. Mirror each kind's `docs/primitives/draw/<kebab>.md`.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.disjointChannel` | disjoint-channel | Offset (disjoint) parallel channel. |
| `draw.trendChannel` | trend-channel | Parallel trend channel over two pivots. |
| `draw.regressionTrend` | regression-trend | Linear-regression channel over N bars. |
| `draw.flatTopBottom` | flat-top-bottom | Flat-top/flat-bottom consolidation channel. |
| `draw.pitchfork` | pitchfork | Andrews pitchfork from three pivots. |
| `draw.pitchfan` | pitchfan | Pitchfan from three pivots. |
| `draw.cyclicLines` | cyclic-lines | Repeating vertical cycle lines. |
| `draw.timeCycles` | time-cycles | Time-cycle markers at a fixed period. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×8) | Create | One per kind. |
| `examples/catalogue/draw-channels.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×8) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-channels.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind; catalogue + allowlist
  updated; generators re-run; gates green.
