# Draw — Fibonacci Family

> **Status: TODO**

## Goal

One runnable example per Fibonacci `draw.*` kind, category
`draw-fibonacci`; shrink the allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook

Follow the draw.* playbook in [Task 11](./11-draw-lines.md). Every fib
kind anchors on a swing leg — derive the two (or more) endpoints from a
recent `ta.pivotsHighLow` high/low pair tracked in `state.*`, anchored
with `bar.point`. Default fib levels unless the kind requires explicit
levels; mirror each kind's `docs/primitives/draw/<kebab>.md` anchor +
levels shape. `overlay: true`.

> A `fib-retracement` example already exists at
> `examples/scripts/fib-retracement.chart.ts` (Phase-3). If
> `draw.fibRetracement` is already covered in the catalogue, it will be
> absent from the allowlist — skip it; otherwise add a catalogue entry
> referencing the existing file.

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.fibRetracement` | fib-retracement | covered/existing file — wire catalogue if missing. |
| `draw.fibChannel` | fib-channel | Fib channel along a trend leg. |
| `draw.fibCircles` | fib-circles | Fib circles centered on a pivot. |
| `draw.fibSpeedArcs` | fib-speed-arcs | Fib speed-resistance arcs. |
| `draw.fibSpeedFan` | fib-speed-fan | Fib speed-resistance fan. |
| `draw.fibSpiral` | fib-spiral | Fib spiral from a pivot. |
| `draw.fibTimeZone` | fib-time-zone | Fib time zones from an anchor bar. |
| `draw.fibTrendExtension` | fib-trend-extension | Fib trend-based extension. |
| `draw.fibTrendTime` | fib-trend-time | Fib trend-time projection. |
| `draw.fibWedge` | fib-wedge | Fib wedge between two legs. |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (≈9 new) | Create | One per uncovered kind. |
| `examples/catalogue/draw-fibonacci.ts` | Create (own) | Add entries (incl. fib-retracement wiring). |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-fibonacci.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered kind, anchored on a
  tracked swing leg; catalogue + allowlist updated; generators re-run;
  gates green.
