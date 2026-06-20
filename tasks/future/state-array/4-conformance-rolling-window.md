# Task 4 — Conformance scenario: `state.array` rolling window

> **Status: TODO**

## Goal

Add a shared conformance scenario that compiles + runs an indicator using
`state.array` to maintain a rolling window of the last K closes, and proves
its rolling mean is bar-for-bar identical to `ta.sma(bar.close, K)` once warm
— locking the new persistent-collection primitive into the cross-host /
cross-adapter suite.

## Prerequisites

Task 2 (runtime `state.array` slot works; `push`/`get`/`size` accumulate and
FIFO-evict; snapshot/restore work).

## Current Behavior

- `packages/conformance/src/scenarios/` holds shared scenarios; the closest
  precedents are `barCloseDirectIndex.scenario.ts` (direct `bar.close[N]`
  indexing vs `ta.sma`) and `stateSeriesHistory.scenario.ts` (if
  `state-series` landed). No scenario exercises a persistent collection.
- Each scenario exports inline `SOURCE`, pinned `plot-hash` assertions keyed by
  the injected `slotId` (`<inline:...>.chart.ts:<line>:<col>#0`), and is
  registered in `scenarios/index.ts` (`ALL_SCENARIOS` / the phase array).

## Desired Behavior

- A new scenario compiles a script that pushes `bar.close` into a
  `state.array<number>(5)` each bar, computes the window mean over
  `0..size-1`, and plots it alongside `ta.sma(bar.close, 5)`. Assertions prove
  the window-mean plot is a stable finite series (its own pinned SHA-256) and
  that `ta.sma(5)` pins to its own — the same shape as
  `barCloseDirectIndex.scenario.ts`, where the manual and built-in forms track
  to display precision but pin to distinct hashes (incremental running-sum vs
  recomputed-sum float bits differ).

## Requirements

1. Mirror `barCloseDirectIndex.scenario.ts` exactly (inline source, virtual
   `<inline:...>.chart.ts` `sourcePath`, `plot-hash` assertions pinned from the
   first deterministic run, `diagnostic-code-absent` for `lookback-exceeded`).
   Do **not** invent a new scenario format.

2. Script under test (a rolling window via `state.array`, with an in-loop
   `get(i)` to exercise that handle methods are loop-legal):

   ```ts
   import { defineIndicator, plot, state, ta } from "@invinite-org/chartlang-core";

   export default defineIndicator({
       name: "Rolling window mean",
       apiVersion: 1,
       overlay: true,
       compute({ bar, state, ta, plot }) {
           const win = state.array<number>(5);
           win.push(bar.close.current);
           let sum = 0;
           for (let i = 0; i < win.size; i++) sum += win.get(i);
           plot(win.size > 0 ? sum / win.size : 0, { title: "Window mean(5)" });
           plot(ta.sma(bar.close, 5), { title: "ta.sma(5)" });
       },
   });
   ```

   Note the rolling-window mean equals an **un-warmed** SMA during warmup
   (it averages over `size < 5` bars, not `NaN`), so its hash will NOT match
   `ta.sma`'s warmup-`NaN` bars. That is fine — pin each plot to its own
   SHA-256, exactly as `barCloseDirectIndex` does for its two distinct-hash
   plots. The scenario's value is the end-to-end proof that `state.array`
   compiles, allocates, accumulates with FIFO eviction, survives the
   close/commit discipline, and emits a stable finite series.

3. Assert (via the suite's `plot-hash` vocabulary): the window-mean plot pins
   to a SHA-256 and the `ta.sma(5)` plot pins to its own. Pin both from the
   runner's "expected vs actual" message, per the conformance re-pin workflow.
   Add `{ kind: "diagnostic-code-absent", code: "lookback-exceeded" }`.

4. (Recommended) Add a second assertion variant or a sibling scenario that
   drives the same script through a **snapshot → warm-restart** cycle and
   re-pins the post-restart window-mean hash equal to the cold-run hash — this
   pins that the `:array` snapshot/restore (Task 2 §5) is correct end-to-end.
   If the conformance harness has no warm-restart hook, leave this to Task 2's
   runtime snapshot test and note it here.

5. Register the scenario in `packages/conformance/src/scenarios/index.ts`
   (import + re-export + add to `ALL_SCENARIOS` / the relevant phase array,
   following the existing entries). Run `pnpm conformance` and
   `pnpm conformance:check`.

## Edge cases

- Warmup: the window mean averages over `size` (< capacity early), so it is
  finite from bar 0 (no `NaN` warmup) — distinct from `ta.sma`'s `NaN` warmup.
  Do NOT assert the two hashes are equal; pin each separately.
- Capacity: the `state.array<number>(5)` literal bounds the ring at 5; once
  warm, `size === 5` and the mean is a true SMA(5) to display precision.
- The in-loop `win.get(i)` must NOT trip `stateful-call-inside-loop` (handle
  method, not registry callsite) — if it does, Task 1/the registry is wrong;
  fail loudly rather than rewrite the loop.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/stateArrayRollingWindow.scenario.ts` | Create | `state.array` rolling-window mean is a stable finite series. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register the scenario. |

## Gates

- `pnpm conformance`, `pnpm conformance:check`
- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (no separate bump for conformance
fixtures — match repo convention).

## Acceptance Criteria

- New scenario compiles + runs across the suite and is registered.
- The window-mean plot pins to a stable SHA-256; `ta.sma(5)` pins to its own;
  `lookback-exceeded` is absent.
- (If added) the warm-restart variant re-pins equal to the cold run.
- `pnpm conformance` + `pnpm conformance:check` green.
