# Task 19 — `fib-retracement.chart.ts` example script + `drawAll61.scenario.ts` smoke test

> **Status: TODO**

## Goal

Land the fourth Phase-1-deferred example script under
`examples/scripts/fib-retracement.chart.ts` (per Phase 1 README's
4-script promise — the three Phase-1 demos shipped, this one
defers because it needs Phase 3's `draw.fib.retracement`). Plus
the `drawAll61.scenario.ts` smoke test exercising every drawing
kind in a single script — verifies the per-script budget +
`unsupported-drawing-kind` paths and pins a comprehensive
end-to-end hash.

## Prerequisites

- Tasks 1–18 (all 61 kinds emittable + renderable + covered).
- Task 1's `ScriptManifest.maxDrawings?` + `DefineIndicatorOpts.maxDrawings?`
  extension (used by the `fib-retracement.chart.ts` script's
  `defineIndicator({ ..., maxDrawings: { ... } })` opts).

## Requirements

### 1. `examples/scripts/fib-retracement.chart.ts`

A curated end-to-end indicator script that:
- Reads the last 200 bars of swing high/low (via `ta.highest` /
  `ta.lowest` from Phase 2).
- Emits one `draw.fib.retracement(swingLow, swingHigh)` per
  swing detected (limited by `maxDrawings.other: 5`).
- Annotates each level with a `draw.text` label.
- Updates the active retracement's `to` price each bar via
  `handle.update({ to: ... })` until the swing is invalidated.

Target line count: ~40 lines. Style matches the existing
Phase-1 demos.

`defineIndicator({ name: "Fib Retracement", apiVersion: 1,
overlay: true, maxDrawings: { lines: 0, labels: 25, boxes: 0,
polylines: 0, other: 5 }, compute({...}) { ... } })`.

### 2. `packages/conformance/src/scenarios/drawAll61.scenario.ts`

A smoke scenario whose script emits one of every `DrawingKind`
across the 10 000-bar fixture. Uses inline source. Asserts:
- `drawing-hash` (no `handleId` filter — full sweep) pinned to
  the first deterministic run.
- `diagnostic-code-absent: "unsupported-drawing-kind"` — every
  kind is emittable through canvas2d.
- `diagnostic-code-absent: "drawing-budget-exceeded"` — the
  canvas2d budget (Task 4) fits 61 emissions.

```ts
const SOURCE = `
import { defineIndicator, draw } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw-all-61",
    apiVersion: 1,
    compute({ bar }) {
        if (bar.time === FIRST_BAR_TIME) {
            // 61 draw.* calls, one per kind.
            draw.line({ time: FIRST_BAR_TIME, price: 100 }, ...);
            draw.horizontalLine(110);
            draw.horizontalRay(...);
            // ... 58 more
            draw.frame(...);
        }
    },
});
`;
```

The exact 61-call script is built mechanically from
`DRAWING_KINDS` — each kind gets a one-line call with hardcoded
anchors taken from `goldenBars[0]` and `goldenBars[100]`. Keep
the source compact (~80 lines).

Variant cases:
- `draw.pitchfork(a, b, c, { variant: "schiff" })` — exercises
  the non-default variant path.
- `draw.path([p1, p2, p3])` vs `draw.polyline([p1, p2, p3])` —
  exercise the open/closed distinction.

### 3. Budget-overflow companion scenario —
`packages/conformance/src/scenarios/drawBudgetOverflow.scenario.ts`

A scenario that emits MORE than the canvas2d budget per bucket
(e.g. 250 `draw.line` calls, exceeding the `lines: 200` cap).
Asserts:
- `diagnostic-code-present: "drawing-budget-exceeded"` (at
  least one).
- `drawing-hash` pinned over the first 200 emissions (the
  budget-respecting subset).

### 4. Capability-gating companion scenario —
`packages/conformance/src/scenarios/drawUnsupportedKind.scenario.ts`

Uses a synthetic adapter with `capabilities.drawings = new
Set(["line"])` (one kind only). Script tries to emit
`draw.rectangle(...)`. Asserts:
- `diagnostic-code-present: "unsupported-drawing-kind"`.
- `drawing-hash` for the line emission pinned (the rectangle
  drops, the line stays).

(This scenario takes a `capabilities` override — extend
`Scenario` if needed, but the existing `runConformanceSuite` API
should already let a scenario override the adapter implicitly
via `RunConformanceSuiteOpts`. If not, this scenario uses an
inline-defined adapter passed through a new
`Scenario.capabilitiesOverride?: Capabilities` field. Decide
during the PR — prefer reusing the existing surface.)

### 5. Updates to `scenarios/index.ts`

Add the 3 new scenarios to the re-export list.

### 6. README + docs updates

- `examples/README.md` adds an entry for the new
  `fib-retracement.chart.ts` script.
- `docs/examples/` (if it exists) gets a copy. If not, defer to
  the Phase-4 doc-site work.

## Tests

- `fib-retracement.chart.ts` is exercised by the existing
  `examples/canvas2d-adapter/src/integration.test.ts` (extend
  to include the new script in the smoke set).
- The 3 new scenarios pass against the canvas2d default
  adapter.
- A new `runConformanceSuite.test.ts` test covers the
  `drawAll61.scenario.ts` and `drawBudgetOverflow.scenario.ts`
  end-to-end through a real (non-mocked) `runConformanceSuite`
  invocation.

## Files to Create / Modify

| File | Action |
|------|--------|
| `examples/scripts/fib-retracement.chart.ts` | Create |
| `examples/README.md` | Modify |
| `packages/conformance/src/scenarios/drawAll61.scenario.ts` | Create |
| `packages/conformance/src/scenarios/drawBudgetOverflow.scenario.ts` | Create |
| `packages/conformance/src/scenarios/drawUnsupportedKind.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify (smoke scenario coverage) |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify (include new example) |
| `.changeset/phase-3-task-19-example-and-smoke.md` | Create |

## Gates

- `pnpm typecheck`, `pnpm test`, `pnpm conformance`, `pnpm
  bench:ci`, `pnpm docs:check`, `pnpm readme:check`.

## Changeset

Minor on `@invinite-org/chartlang-conformance` (3 new scenarios).
No version bump on examples (not published).

## Acceptance Criteria

- `examples/scripts/fib-retracement.chart.ts` ships at ~40
  lines, compiles, renders through canvas2d.
- `drawAll61.scenario.ts` emits all 61 kinds without
  `unsupported-drawing-kind` or `drawing-budget-exceeded`
  diagnostics; pinned hash.
- `drawBudgetOverflow.scenario.ts` triggers
  `drawing-budget-exceeded` at the configured bucket cap.
- `drawUnsupportedKind.scenario.ts` triggers
  `unsupported-drawing-kind` for the missing kinds.
- 100% coverage maintained.
- Phase-1/-2 + Tasks 1–18 gates green.
- Changeset committed.
