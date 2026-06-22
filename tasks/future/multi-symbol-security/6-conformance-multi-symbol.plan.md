# Task 6 plan — Conformance: two-symbol ratio scenario + golden

## Context

Tasks 1–5 landed the composite `(symbol, interval)` `feedKey` end-to-end:
`feedKey(symbol, interval)` (`packages/core/src/request/feedKey.ts`) →
`manifest.requestedFeeds` → runtime keys every secondary map/cache by `feedKey`
→ host `CandleEvent.streamKey` carries the composite → `Capabilities.multiSymbol`
gate with `multi-symbol-not-supported` (message: "Adapter declares
multiSymbol: false; request.security for a different symbol returns NaN"). Gate
order: symbol → timeframe → unsupported-interval → unknown-secondary-stream. All
5 reference adapters advertise `multiSymbol: true`.

This task adds the CONFORMANCE proof: a two-symbol ratio scenario + golden + a
capability-false NaN-fallback scenario + a distinctness guard test, mirroring the
existing MTF scenarios.

## Key finding (reuse)

The harness ALREADY routes composite keys: `runConformanceSuite.runOne`
(`runConformanceSuite.ts:772-786`) iterates `scenario.secondaryCandles` and
feeds each `secondaryCandles[K]` bar tagged with `streamKey: K`. The runtime keys
secondary streams by `feedKey`, so a `secondaryCandles` keyed by the composite
`"AMEX:SPY@1D"` works with NO routing change.

Per the task's explicit preference ("Prefer the explicit `secondaryFeeds` shape;
clearer; no parsing"), I add a thin `secondaryFeeds?: ReadonlyArray<{ symbol?,
interval, bars }>` field whose entries the harness folds into the existing
`secondaryCandles` iteration by deriving the key via `feedKey(symbol, interval)`.
`secondaryCandles` stays working untouched (back-compat — `mtfRequestSecurityClose`
keeps its bare `"1D"` key). This keeps `feedKey` the single source of truth for
the key in the scenario file (no hand-composed `"AMEX:SPY@1D"` string).

## Pre-existing work

None of the Task-6 files exist. Verified absent: `multiSymbolFixtures.ts`,
`multiSymbolRatio.scenario.ts`, `multiSymbolRatio.test.ts`,
`multiSymbolNotSupported.scenario.ts`. No naming conflict on
`MTF_SPY_FIXTURE_BARS` / `MULTI_SYMBOL_*` exports.

## Issues / decisions

- `secondaryFeeds` derives keys via `feedKey` (core helper) — never hand-compose.
- Reference adapter symInfo ticker is "DEMO"; SPY/QQQ are different symbols, so
  `resolveSymbol` does NOT collapse them — they survive as distinct feeds.
- Capabilities merge: scenarios set `capabilitiesOverride` so gating is
  independent of each adapter's defaults (all advertise multiSymbol: true).
- Fixture closes: SPY 600/620/640, QQQ 300/310/320 → ratio ~2.0 (finite, ≠ 1,
  outside main golden band ~100, denominator never 0). Same timestamps as
  `MTF_DAILY_FIXTURE_BARS` (timestamp-aligned).
- Changeset: conformance is `private`/unpublished tooling → no changeset bump
  (mirrors how MTF scenarios were handled — they added no conformance changeset).
  Confirm `private: true` in package.json before finalising.
- Hashes pinned by running the scenario through the harness and copying `actual`
  from the failure message — both happy-path ratio hash and all-NaN hash.

## Steps

1. `runConformanceSuite.ts`: add `SecondaryFeed` type + `Scenario.secondaryFeeds?`
   field with JSDoc; in `runOne`, before/with the `secondaryCandles` loop, fold
   `secondaryFeeds` entries into the same per-key feed iteration using
   `feedKey(feed.symbol, feed.interval)` as the streamKey. Import `feedKey` from
   core. Export `SecondaryFeed` from `runConformanceSuite.ts` + `src/index.ts`.
2. Create `scenarios/multiSymbolFixtures.ts`: `MTF_SPY_FIXTURE_BARS`,
   `MTF_QQQ_FIXTURE_BARS` (3 daily bars each, distinct closes + symbols,
   timestamps aligned to `MTF_DAILY_FIXTURE_BARS`). Reuse the `makeBar` pattern.
3. Create `scenarios/multiSymbolRatio.scenario.ts`: inline ratio indicator,
   `capabilitiesOverride { multiTimeframe: true, multiSymbol: true }`,
   `secondaryFeeds` with both symbols, assertions: plot-hash + 3
   diagnostic-code-absent (multi-symbol-not-supported / multi-timeframe-not-supported
   / unknown-secondary-stream).
4. Create `scenarios/multiSymbolNotSupported.scenario.ts`: same source,
   `{ multiTimeframe: true, multiSymbol: false }`, all-NaN plot-hash +
   diagnostic-code-present multi-symbol-not-supported.
5. Create `scenarios/multiSymbolRatio.test.ts`: distinctness guard — compile +
   drive via createScriptRunner with both fixtures, assert ratio finite ≠ 1.
6. Register both scenarios in `scenarios/index.ts` (imports, re-exports,
   ALL_SCENARIOS) and `src/index.ts` re-exports. Add `MULTI_SYMBOL_SCENARIOS`
   group to `runConformanceSuite.test.ts` end-to-end pass.
7. Update `packages/conformance/CLAUDE.md` with the multi-symbol invariant +
   `secondaryFeeds` keying + distinctness guard.
8. Pin hashes via harness; run `pnpm -F @invinite-org/chartlang-conformance test`;
   regenerate reports via `pnpm conformance:report`; `pnpm conformance:check`.

## Files

| File | Action |
|------|--------|
| `packages/conformance/src/runConformanceSuite.ts` | Modify — `secondaryFeeds` + `SecondaryFeed` type |
| `packages/conformance/src/index.ts` | Modify — export `SecondaryFeed`, both scenarios |
| `packages/conformance/src/scenarios/multiSymbolFixtures.ts` | Create |
| `packages/conformance/src/scenarios/multiSymbolRatio.scenario.ts` | Create |
| `packages/conformance/src/scenarios/multiSymbolRatio.test.ts` | Create |
| `packages/conformance/src/scenarios/multiSymbolNotSupported.scenario.ts` | Create |
| `packages/conformance/src/scenarios/index.ts` | Modify — register both |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify — `MULTI_SYMBOL_SCENARIOS` pass |
| `packages/conformance/CLAUDE.md` | Modify — invariant |
| `examples/canvas2d-adapter/CONFORMANCE.md` + 4 other adapter reports + `conformance-report.json` | Regenerate via harness |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-conformance test` (coverage 100%)
- `pnpm conformance` + `pnpm conformance:check`
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

None (conformance is unpublished tooling; matches MTF-scenario precedent).
Confirm `private: true`.

## Acceptance criteria

- Two-symbol ratio: finite, distinct-per-symbol pinned plot-hash; no
  multi-symbol-not-supported / unknown-secondary-stream / multi-timeframe-not-supported.
- Capability-false: all-NaN hash + multi-symbol-not-supported present.
- Distinctness guard asserts ratio finite ≠ 1.
- `mtfRequestSecurityClose` unchanged.
- Both registered; CLAUDE.md updated; conformance + conformance:check green
  across all 5 adapters; docs:check green.
