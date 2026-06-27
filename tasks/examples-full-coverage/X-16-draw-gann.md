# Draw — Gann

> **Status: TODO**

## Goal

One runnable example per Gann `draw.*` kind, category `draw-gann`;
shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Gann kinds
anchor on a pivot + a scale/ratio. Derive the base anchor from a tracked
swing via `bar.point`; mirror each kind's
`docs/primitives/draw/<kebab>.md` for the box/square/fan parameters.
`overlay: true`.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.gannBox` | gann-box | Gann box over a swing range. |
| `draw.gannFan` | gann-fan | Gann fan from a pivot. |
| `draw.gannSquare` | gann-square | Gann square over a range. |
| `draw.gannSquareFixed` | gann-square-fixed | Fixed-scale Gann square from an anchor. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×4) | Create | One per kind. |
| `examples/catalogue/draw-gann.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×4) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-gann.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per kind; catalogue + allowlist
  updated; generators re-run; gates green.
