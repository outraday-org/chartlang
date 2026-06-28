# Draw — Harmonic & Chart Patterns

> **Status: TODO**

## Goal

One runnable example per harmonic / chart-pattern `draw.*` kind,
category `draw-patterns`; shrink the allowlist by these ids. This task
completes `draw.*` coverage.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Harmonic
patterns take an ordered labeled point list (ABCD = 4, XABCD = 5,
three-drives = several). Build from tracked pivots in `state.*` or fixed
`bar.point` offsets; mirror each kind's
`docs/primitives/draw/<kebab>.md` for the exact point count + labels.
`overlay: true`.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.abcdPattern` | abcd-pattern | 4-point ABCD harmonic pattern. |
| `draw.cypherPattern` | cypher-pattern | 5-point Cypher harmonic pattern. |
| `draw.xabcdPattern` | xabcd-pattern | 5-point XABCD harmonic pattern. |
| `draw.threeDrivesPattern` | three-drives-pattern | Three-drives reversal pattern. |
| `draw.headAndShoulders` | head-and-shoulders | Head-and-shoulders over five pivots. |
| `draw.trianglePattern` | triangle-pattern | Triangle continuation pattern. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×6) | Create | One per kind. |
| `examples/catalogue/draw-patterns.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×6) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-patterns.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind with the correct point
  count; catalogue + allowlist updated; generators re-run; gates green.
  `draw.*` coverage is now complete.
