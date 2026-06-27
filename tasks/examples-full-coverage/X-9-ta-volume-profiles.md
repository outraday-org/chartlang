# TA — Volume Profiles

> **Status: TODO**

## Goal

One runnable example per volume-profile `ta.*` primitive, category
`ta-volume-profile`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Per [Task 3](./3-ta-moving-averages.md). Volume profiles return
structured profile data (POC / value-area / bins) over a range anchor,
not a simple per-bar series. **Edge cases:** (1) they read `bar.volume`
— NaN/empty render acceptable if the demo lacks volume, no throw; (2)
the range anchor (anchored/fixed/session/visible) must be constructed
from `bar.point` / timestamps or the documented anchor option — check
each primitive's `docs/primitives/ta/<id>.md` signature for the exact
anchor argument shape and mirror it. Render the POC line via `plot` (or
the documented profile-render helper) so the example is visually
meaningful where data allows. `overlay: true` (price scale).

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.anchoredVolumeProfile` | new | Profile anchored at a fixed bar; plot POC. |
| `ta.fixedRangeVolumeProfile` | new | Profile over a fixed bar range; plot POC + value area. |
| `ta.sessionVolumeProfile` | new | Per-session profile; plot session POC. |
| `ta.visibleRangeVolumeProfile` | new | Visible-range profile; plot POC. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×4) | Create | One per id. |
| `examples/catalogue/ta-volume-profiles.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` (×4) | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-ta-volume-profiles.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per id, each constructing the
  correct range anchor; catalogue + allowlist updated; generators
  re-run; gates green.
