# Task 3 — Conformance scenario: direct `bar.close[N]` indexing

> **Status: DONE**

## Goal

Add a shared conformance scenario that compiles + runs an indicator which
builds a manual SMA by indexing `bar.close` **directly** (no `ta.ema(_,1)`
trick) and proves it is bar-for-bar identical to `ta.sma(bar.close, N)`. This
locks the new directly-indexable-bar-series behavior into the cross-host /
cross-adapter conformance suite.

## Prerequisites

Task 2 (runtime wiring complete — `bar.close[N]` works at runtime).

## Current Behavior

- `packages/conformance/scenarios/` holds shared scenarios exercised by the
  runtime, hosts, and the reference adapter.
- No scenario indexes raw `bar.*` fields; the closest is the demo's `ta.ema(_,1)`
  workaround (not in conformance).

## Desired Behavior

- A new scenario compiles a script using `bar.close[0..N-1]` directly and
  asserts the resulting series equals `ta.sma(bar.close, N)` within the
  suite's standard numeric tolerance, including the warmup window (NaN until
  N closes are filled).

## Requirements

1. Inspect an existing `ta.*` golden/identity scenario in
   `packages/conformance/scenarios/` for the exact scenario shape (script
   source, input bars / fixture, expected emissions, tolerance) and mirror it —
   do **not** invent a new scenario format.
2. Script under test (the same logic as the rewritten Manual SMA demo so the two
   stay in sync):

   ```ts
   import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

   export default defineIndicator({
       name: "Direct close SMA",
       apiVersion: 1,
       overlay: true,
       compute({ bar, ta, plot }) {
           const manual = (bar.close[0] + bar.close[1] + bar.close[2] +
               bar.close[3] + bar.close[4]) / 5;
           plot(manual, { title: "Manual SMA(5)" });
           plot(ta.sma(bar.close, 5), { title: "ta.sma(5)" });
       },
   });
   ```

3. Assert the two plotted series match bar-for-bar (both `NaN` during the
   4-bar warmup, equal thereafter). Reuse the suite's tolerance constant.
4. Register the scenario wherever the suite enumerates scenarios (follow the
   pattern of the existing entries) so runtime + hosts + reference adapter all
   pick it up. Run `pnpm conformance` and `pnpm conformance:check`.

## Edge cases

- Warmup: `bar.close[4]` is `NaN` until 5 bars are filled, so `manual` is `NaN`
  for bars 0–3 — must match `ta.sma`'s warmup exactly.
- `bar.close[N]` past retained history is `NaN` (do not assert finite values in
  warmup).
- Capacity: the compiler's `extractMaxLookback` already sizes the buffer from
  `bar.close[4]` → capacity ≥ 5; the scenario implicitly verifies this.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/scenarios/<new-scenario>.ts` (+ fixtures) | Create | Direct-index SMA == `ta.sma`. |
| Scenario registry/index in `packages/conformance/` | Modify | Register the new scenario. |

## Gates

- `pnpm conformance`, `pnpm conformance:check`
- `pnpm -F @invinite-org/chartlang-conformance test` (if the package has its own)
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (no separate semver bump for conformance
fixtures unless the package is published — match repo convention).

## Acceptance Criteria

- New scenario compiles + runs across the suite and is registered.
- Manual `bar.close[0..4]` series equals `ta.sma(bar.close, 5)` bar-for-bar
  (incl. warmup) within tolerance.
- `pnpm conformance` + `pnpm conformance:check` green.
