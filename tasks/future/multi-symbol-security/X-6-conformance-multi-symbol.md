# Task 6 — Conformance: two-symbol ratio scenario + golden

> **Status: DONE**

## Goal

Prove the composite `(symbol, interval)` key end-to-end through the
compiler→runtime conformance harness: a **two-symbol ratio indicator**
(`SPY/QQQ`) whose pinned `plot-hash` carries finite, distinct-per-symbol
values, plus a `multiSymbol: false` capability-false scenario asserting the new
`multi-symbol-not-supported` NaN fallback. Mirror the existing
`mtfRequestSecurityClose` / `mtfCapabilityFalse` scenario shape exactly.

## Prerequisites

Tasks 3 (runtime composite keying), 4 (`Capabilities.multiSymbol` +
`feedKey`-built `streamKey` in the mock/harness path), 5 (the
`multi-symbol-not-supported` gate).

## Current Behavior

- `mtfRequestSecurityClose.scenario.ts` plots `request.security({ interval:
  "1D" }).close` against `secondaryCandles: { "1D": MTF_DAILY_FIXTURE_BARS }`
  with `capabilitiesOverride: { multiTimeframe: true }`, pinning a `plot-hash`
  + `diagnostic-code-absent` assertions.
- `mtfFixtures.ts` supplies `MTF_DAILY_FIXTURE_BARS` (3 daily bars; symbol
  `"GOLDEN"`, interval `"1D"`).
- `mtfCapabilityFalse.scenario.ts` runs the same script with `multiTimeframe:
  false` and asserts the all-NaN fallback + `multi-timeframe-not-supported`.
- `Scenario.secondaryCandles` is keyed by **interval** today
  (`{ "1D": bars }`) — the harness feeds those bars tagged with that key as the
  `streamKey`.
- `runConformanceSuite` reads `adapter.capabilities`, owns candle iteration,
  and pins `plot-hash` over `{ bar, value }` tuples
  (`packages/conformance/CLAUDE.md`).

## Desired Behavior

- A new `multiSymbolRatio.scenario.ts`: an inline indicator reading two
  symbols at the same interval and plotting their close ratio:

  ```ts
  compute({ plot, request }) {
      const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
      const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
      plot(spy.close / qqq.close);
  }
  ```

  Driven against two secondary streams keyed by the composite `feedKey`
  (`"AMEX:SPY@1D"`, `"NASDAQ:QQQ@1D"`), with `capabilitiesOverride:
  { multiTimeframe: true, multiSymbol: true }`. The pinned `plot-hash` carries
  finite ratio values that could ONLY arise from two distinct symbol streams
  (choose fixture closes so SPY≠QQQ and the ratio lands in a band the main
  golden never reaches — the distinctness proof, exactly as
  `mtfSecurityExpressionEma` does).
- A `multiSymbolNotSupported.scenario.ts`: the same script against
  `{ multiTimeframe: true, multiSymbol: false }`, asserting an all-NaN
  `plot-hash` + `diagnostic-code-present: "multi-symbol-not-supported"`.
- `Scenario.secondaryCandles` keys widen to accept composite `feedKey`s (or a
  parallel `secondaryFeeds` field) so the harness can register two symbols.

## Requirements

### 1. Widen `Scenario.secondaryCandles` keying (`runConformanceSuite.ts`)

`secondaryCandles` is keyed by `streamKey` already — confirm whether the
harness treats the key as a bare interval anywhere (e.g. capability gating by
interval). Widen it to accept composite `feedKey`s: the harness feeds each
`secondaryCandles[K]` bar array tagged with `streamKey: K`. If the harness
needs to know each feed's `(symbol, interval)` for capability checks, either
parse it back via a `feedKey` inverse or add a small `secondaryFeeds:
ReadonlyArray<{ symbol?, interval, bars }>` field and derive the key via
`feedKey`. Prefer the explicit `secondaryFeeds` shape (clearer; no parsing) and
keep `secondaryCandles` working for single-interval scenarios (back-compat).

### 2. Two-symbol fixture (`mtfFixtures.ts` or a new `multiSymbolFixtures.ts`)

Add `MTF_SPY_FIXTURE_BARS` / `MTF_QQQ_FIXTURE_BARS` — two 3-bar daily fixtures
with the same timestamps as `MTF_DAILY_FIXTURE_BARS` (so alignment is clean)
but **distinct closes** and distinct `symbol` fields (`"AMEX:SPY"` /
`"NASDAQ:QQQ"`). Choose closes so the ratio is finite and in a recognisable
band.

### 3. Happy-path scenario (`multiSymbolRatio.scenario.ts`)

Mirror `mtfRequestSecurityClose.scenario.ts`: `const ASSERTIONS:
ReadonlyArray<ScenarioAssertion>` declared above the literal (the
literal-narrowing invariant), `inlineSource`, `intervalCount`/`candleLimit`,
`capabilitiesOverride: { multiTimeframe: true, multiSymbol: true }`,
`secondaryFeeds` with both symbols, and assertions:
- `plot-hash` (re-mint via the harness's "expected vs actual" message),
- `diagnostic-code-absent: "multi-symbol-not-supported"`,
- `diagnostic-code-absent: "multi-timeframe-not-supported"`,
- `diagnostic-code-absent: "unknown-secondary-stream"`.

### 4. Capability-false scenario (`multiSymbolNotSupported.scenario.ts`)

Mirror `mtfCapabilityFalse.scenario.ts`: same source, `capabilitiesOverride:
{ multiTimeframe: true, multiSymbol: false }`, assert all-NaN `plot-hash` +
`diagnostic-code-present: "multi-symbol-not-supported"`.

### 5. Distinctness guard test (`multiSymbolRatio.test.ts`)

Because the harness vocabulary can't express "the two series are distinct",
add a co-located guard test (mirror `mtfSecurityExpressionEma.test.ts`):
compile the scenario source, drive it through `createScriptRunner` with the
`{ multiTimeframe: true, multiSymbol: true }` bag + both fixtures, and assert
the ratio is finite and ≠ 1 (i.e. SPY and QQQ resolved to different streams,
not the same one) — the regression guard that the composite key actually
separates symbols.

### 6. Register scenarios

Add both to `ALL_SCENARIOS` (and the appropriate phase group, e.g. a
`MULTI_SYMBOL_SCENARIOS` list folded into the end-to-end pass in
`runConformanceSuite.test.ts`), so they run in the full suite.

## Edge cases

- Same timestamps across SPY/QQQ keep no-lookahead alignment trivial; document
  that the fixture is timestamp-aligned on purpose (a session-mismatch case is
  README-deferred).
- A symbol-omitted control: keep `mtfRequestSecurityClose` passing unchanged
  (its bare-interval `secondaryCandles` keys are byte-identical via
  `feedKey(undefined, "1D") === "1D"`) — proves back-compat through the harness.
- The ratio's denominator must never be zero in the fixture (no `Infinity` in
  the golden).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Accept composite-keyed / `secondaryFeeds` secondary streams; keep `secondaryCandles` back-compat. |
| `packages/conformance/src/scenarios/multiSymbolFixtures.ts` | Create | SPY/QQQ timestamp-aligned, distinct-close fixtures. |
| `packages/conformance/src/scenarios/multiSymbolRatio.scenario.ts` | Create | Happy-path two-symbol ratio + pinned hash. |
| `packages/conformance/src/scenarios/multiSymbolRatio.test.ts` | Create | Distinctness guard (ratio finite ≠ 1). |
| `packages/conformance/src/scenarios/multiSymbolNotSupported.scenario.ts` | Create | `multiSymbol: false` NaN fallback. |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Register the new scenarios in the suite pass. |
| `packages/conformance/CLAUDE.md` | Modify | Document the multi-symbol scenarios + the `secondaryFeeds` composite-key keying + the distinctness guard. |

## Gates

- `pnpm -F @invinite-org/chartlang-conformance test` (coverage thresholds;
  pinned hashes green)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Conformance is unpublished tooling — confirm whether it needs a changeset
entry (likely not; the feature changeset from Task 1 covers published
packages). If `@invinite-org/chartlang-conformance` is published, add it as a
patch to the feature changeset.

## Acceptance Criteria

- Two-symbol ratio scenario: finite, distinct-per-symbol pinned `plot-hash`;
  no `multi-symbol-not-supported` / `unknown-secondary-stream`.
- Capability-false scenario: all-NaN hash + `multi-symbol-not-supported`
  present.
- Distinctness guard test asserts ratio finite ≠ 1 (symbols truly separated).
- `mtfRequestSecurityClose` unchanged (back-compat through the harness).
- Both scenarios registered in the suite; `packages/conformance/CLAUDE.md`
  updated; conformance tests/docs:check green.
