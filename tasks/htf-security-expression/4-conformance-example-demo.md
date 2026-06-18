# Conformance + example script + live-site demo + integration test

> **Status: TODO**

## Goal

Prove the feature end-to-end and surface it in the runnable artefacts:
new conformance scenario(s) with pinned goldens, the updated example
`.chart.ts` exercised by the CLI + runtime integration tests, and the
**live-site demo** entry (which is also the source of truth for the docs
Examples section). The headline assertion everywhere: the weekly value
from the expression form **differs** from a same-length main-timeframe
EMA (i.e. the original bug is fixed).

## Prerequisites

Task 3 (runtime expression form working end-to-end).

## Current Behavior

- `packages/conformance/src/scenarios/` has `mtfRequestSecurityClose.scenario.ts`
  (happy path) and `requestSecurityNanFallback.scenario.ts` (NaN
  fallback). Scenarios pin `{ kind: "plot-hash", sha256 }` +
  `diagnostic-code-(absent|present)`, with `secondaryCandles` fixtures
  and `capabilitiesOverride`.
- `examples/scripts/htf-trend-filter.chart.ts` uses the **data-only**
  form `ta.ema(request.security({ interval: "1W" }).close, 10)`. It is
  compiled by `packages/cli/src/e2e.test.ts` and driven through the
  runtime by `examples/canvas2d-adapter/src/integration.test.ts`
  ("renders the htf-trend-filter example…") via
  `createMultiStreamCandlePump` with a synthetic 1W stream.
- `apps/site/src/components/demo/scripts.ts` holds the inlined demo copy
  `HTF_TREND_FILTER`. `apps/site/src/components/demo/secondaryStreams.ts`
  + `ChartPane.tsx` already resample the daily `bars.json` into the
  requested weekly stream and route it through the multi-stream pump.

## Desired Behavior

- A new conformance scenario `mtfSecurityExpressionEma` proves the
  expression form computes a weekly EMA over weekly bars (golden
  plot-hash), plus a scenario or assertion proving it **differs** from a
  same-length main EMA, plus a compile-diagnostic scenario for
  `request-security-expr-captures-local`.
- The example, CLI e2e, runtime integration test, and live-site demo all
  use the new callback form and assert finite, distinct HTF output.

## Requirements

### 1. Conformance scenarios

Add under `packages/conformance/src/scenarios/`:

1. `mtfSecurityExpressionEma.scenario.ts` — inline source:
   ```ts
   plot(request.security({ interval: "1D" }, (bar) => ta.ema(bar.close, 10)));
   ```
   `capabilitiesOverride: { multiTimeframe: true }`, reuse the existing
   `secondaryCandles: { "1D": MTF_DAILY_FIXTURE_BARS }` fixture (same one
   `mtfRequestSecurityClose` uses), `intervalCount: 1`. Assertions:
   - `plot-hash` pinned to the runtime's actual output (generate by
     running the scenario once; do **not** hand-author the hash).
   - `diagnostic-code-absent` for `multi-timeframe-not-supported` and
     `request-security-expr-captures-local`.
2. `mtfSecurityExpressionNanFallback.scenario.ts` — same source,
   `multiTimeframe: false` → all-NaN + `multi-timeframe-not-supported`.
3. `securityExpressionCapturesLocal.scenario.ts` — a **compile-fail**
   scenario (if the harness supports diagnostic-only scenarios; else add
   this as a compiler unit test in Task 2 and note it here). Source:
   ```ts
   const k = 10;
   plot(request.security({ interval: "1D" }, (bar) => ta.ema(bar.close, k)));
   ```
   asserts `diagnostic-code-present: request-security-expr-captures-local`.

Register each in the conformance index / `runConformanceSuite.ts`
exactly as the sibling MTF scenarios are registered. Run `pnpm conformance`
to mint the golden hashes, commit them.

### 2. Distinctness assertion

In the runtime integration test (step 4) **and** a conformance assertion
where feasible, compute a same-length main EMA over the same closes and
assert the expression-form series is meaningfully different (e.g. mean
absolute difference over the warm region exceeds a threshold). This is
the regression guard that prevents the feature from silently degrading
back to "looks like the daily EMA."

### 3. Update the example script

`examples/scripts/htf-trend-filter.chart.ts` → callback form:

```ts
const fast = ta.ema(bar.close, 20);
plot(fast, { color: "#26a69a", title: "EMA(20)" });

// Weekly trend computed ON the weekly bars (20 weekly EMA), aligned
// no-lookahead to the chart.
const weeklyTrend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
plot(weeklyTrend, { color: "#ef5350", title: "Weekly EMA(20)" });
```

Keep the two-line MIT header and the import set
(`{ defineIndicator, plot, request, ta }`). Confirm
`packages/cli/src/e2e.test.ts` still lists the path and that its
manifest assertions cover `securityExpressions` (extend if it snapshots
the manifest shape).

### 4. Runtime integration test

`examples/canvas2d-adapter/src/integration.test.ts` ("renders the
htf-trend-filter example…"): update to the callback form. Assert:
- the weekly plot series is finite (no all-NaN),
- it is stair-stepped within each week (holds across the ~7 daily bars),
- it **differs** from a same-length (`ta.ema(close, 20)`) daily EMA over
  the warm region (the distinctness guard).
Update the pinned `hashCallLog` constant (the visual change re-shapes the
call log) — regenerate, don't hand-edit.

### 5. Live-site demo

`apps/site/src/components/demo/scripts.ts`: update `HTF_TREND_FILTER` to
the callback form (mirror the example byte-for-byte where possible) and
update its catalogue `description` to say the weekly EMA is computed over
weekly bars. The demo already feeds the weekly stream via
`secondaryStreams.ts` + `ChartPane.tsx` — **verify** the resampled weekly
stream drives the expression runner (the manifest now carries
`securityExpressions`; confirm `ChartPane.tsx` still keys off
`requestedIntervals`, which remains populated). If a second demo entry
better showcases the contrast (e.g. "Weekly vs Daily EMA"), add one — but
at minimum the existing HTF entry must visibly show the smoother weekly
line. After editing `DEMO_SCRIPTS`, run `pnpm examples:generate` (Task 5
owns the doc regeneration, but re-run here to confirm the gate is green).

### 6. Manual verification

Run the live site (`pnpm --filter chartlang-site dev`, open `?script=htf-trend-filter#demo`)
and confirm the weekly line is now visibly smoother/laggier than the
daily EMA — the user-reported symptom is gone. Capture the observation in
the PR description.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/mtfSecurityExpressionEma.scenario.ts` | Create | Happy-path golden |
| `packages/conformance/src/scenarios/mtfSecurityExpressionNanFallback.scenario.ts` | Create | NaN fallback |
| `packages/conformance/src/scenarios/securityExpressionCapturesLocal.scenario.ts` | Create (if harness supports) | Capture diagnostic |
| `packages/conformance/src/scenarios/index.ts`, `runConformanceSuite.ts` | Modify | Register scenarios |
| `examples/scripts/htf-trend-filter.chart.ts` | Modify | Callback form |
| `packages/cli/src/e2e.test.ts` | Modify | Manifest/compile assertions for the expr form |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | Distinctness + finite + stair-step asserts; re-pin hash |
| `apps/site/src/components/demo/scripts.ts` | Modify | Demo source + description |
| `examples/scripts/CLAUDE.md`, `examples/CLAUDE.md`, `apps/CLAUDE.md` | Modify | Note the expr-form example/demo |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on conformance + canvas2d-adapter)
- `pnpm conformance` (goldens minted + committed)
- `pnpm examples:generate` + `pnpm examples:gate`

## Changeset

No new package bump beyond Tasks 1-3; `apps/site` is private (no
changeset). Conformance/examples changes ride the existing changeset.

## Acceptance Criteria

- [ ] New MTF expression scenarios registered with minted goldens.
- [ ] Distinctness guard asserts the weekly series ≠ same-length daily EMA.
- [ ] Example script, CLI e2e, and runtime integration test on the
      callback form; integration hash re-pinned.
- [ ] Live-site demo updated; weekly line visibly smoother (manual check).
- [ ] `examples:gate` + `conformance` green; coverage 100%.
- [ ] Relevant CLAUDE.md files updated.
