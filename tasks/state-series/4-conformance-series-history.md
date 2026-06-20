# Task 4 — Conformance scenario: `state.series` history

> **Status: TODO**

## Goal

Add a shared conformance scenario that compiles + runs an indicator using
`state.series` to republish `bar.close` and proves its history is bar-for-bar
identical to indexing `bar.close` directly — locking the new
directly-writable-indexable user series into the cross-host / cross-adapter
suite.

## Prerequisites

Task 3 (runtime `state.series` slot works; `s[N]` retains history).

## Current Behavior

- `packages/conformance/src/scenarios/` holds shared scenarios; the closest
  precedent is `barCloseDirectIndex.scenario.ts` (direct `bar.close[N]`
  indexing vs `ta.sma`). No scenario exercises a user-written series.

## Desired Behavior

- A new scenario compiles a script that writes `s.value = bar.close` each bar
  and plots `s[0]` and `s[2]`; assertions prove `s[0]` tracks `bar.close[0]`
  and `s[2]` tracks `bar.close[2]` bar-for-bar (incl. the warmup window where
  `s[2]` is `NaN` until three bars are filled).

## Requirements

1. Mirror `barCloseDirectIndex.scenario.ts` exactly (inline source, virtual
   `<inline:...>.chart.ts` `sourcePath`, `plot-hash` assertions pinned from the
   first deterministic run, `diagnostic-code-absent` for `lookback-exceeded`).
   Do **not** invent a new scenario format.

   Note: this scenario deliberately uses `s.value = bar.close` — a usage that
   IS expressible as `bar.close[N]` — **precisely because** that makes the
   series history checkable bar-for-bar against `bar.close[2]` (the correctness
   proof). It is intentionally a different, simpler script from Task 6's demo
   (which shows a self-referential case that genuinely needs the feature); the
   two are NOT kept identical.

2. Script under test:

   ```ts
   import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

   export default defineIndicator({
       name: "User series lag",
       apiVersion: 1,
       overlay: true,
       compute({ bar, state, plot }) {
           const s = state.series(0);
           s.value = bar.close.current;
           plot(s[0], { title: "s[0]" });
           plot(s[2], { title: "s[2]" });
           plot(bar.close[2], { title: "close[2]" });
       },
   });
   ```

3. Assert (via the suite's `plot-hash` vocabulary): the `s[0]` plot hash
   equals an unshifted `bar.close` plot's, and the `s[2]` plot hash equals the
   `bar.close[2]` plot's — i.e. the `s[2]` and `close[2]` slots pin to the
   **same** SHA-256. (Both warm up identically: `NaN` for bars 0–1, equal
   thereafter — `null`-emitted during warmup.) Pin all three slot hashes from
   the runner's "expected vs actual" message, per the conformance re-pin
   workflow.

4. Register the scenario in `packages/conformance/src/scenarios/index.ts`
   (import + re-export + add to `ALL_SCENARIOS` / the relevant phase array,
   following the existing entries). Run `pnpm conformance` and
   `pnpm conformance:check`.

## Edge cases

- Warmup: `s[2]` is `NaN` until three closes are written (matches
  `bar.close[2]`); do not assert finite values during warmup.
- Capacity: `extractMaxLookback` (Task 2) sizes the ring from `s[2]` →
  capacity ≥ 3; the scenario implicitly verifies it (a `lookback-exceeded`
  diagnostic absent + `s[2]` finite post-warmup).
- The `s[2]` and `bar.close[2]` hashes must be byte-identical — if they differ,
  the series advance/commit discipline (Task 3) is wrong; fail loudly rather
  than re-pin around a real divergence.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/stateSeriesHistory.scenario.ts` | Create | `state.series` history == `bar.close[N]`. |
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
- `s[2]` plot hash is byte-identical to the `bar.close[2]` plot hash
  (incl. warmup); `s[0]` tracks `bar.close[0]`.
- `pnpm conformance` + `pnpm conformance:check` green.
</content>
