# Task 1 — Core types + compiler shim

> **Status: DONE**

## Goal

Introduce `PriceSeries` / `VolumeSeries` (the `number & Series<number>`
intersection) in core, retype the `Bar` OHLCV + derived fields to them, and
mirror everything in the compiler's ambient shim (`program.ts`) so a compiled
script type-checks `bar.close[1]` **and** `bar.close * 2`. Add type-level
tests proving both. Create the feature changeset.

## Prerequisites

None.

## Current Behavior

- `packages/core/src/types.ts`: `Bar.{open,high,low,close,volume,hl2,hlc3,ohlc4,hlcc4}`
  are scalar `Price`/`Volume`. `Series<T>` exists (`current`, `[n]`, `length`).
  `ScalarOrSeries = Series<number> | number`.
- `packages/compiler/src/program.ts`: hand-rolled ambient `.d.ts` shim for
  `@invinite-org/chartlang-core` declares `Bar` with the same scalar fields,
  plus `Series<T>` and `ScalarOrSeries`. Must stay in lockstep with core
  (`compiler/CLAUDE.md` "Core resolves through an ambient shim").
- `bar.close[1]` is a TS error today; `compile()` would reject it.

## Desired Behavior

- `bar.close[1]` (and the other 8 numeric fields) type-checks via the compiler
  program; `bar.close * 2`, `bar.close > x`, `Math.max(bar.close, …)`,
  `ta.ema(bar.close, 20)`, `bar.close.current` all still type-check.
- `time`, `symbol`, `interval` unchanged (scalar `Time`/`string`).

## Requirements

### 1. New core types (`packages/core/src/types.ts`)

Add next to `Series<T>` (which stays unchanged):

```ts
/**
 * A bar price field that is **both** a scalar `Price` (arithmetic,
 * comparison, `plot`, `ta.*` source arg) **and** an indexable
 * `Series<Price>` (`bar.close[1]`, `bar.close.current`). The runtime
 * backs it with a number-coercible ring-buffer view, so `bar.close * 2`
 * reads the current value while `bar.close[1]` reads one bar ago.
 *
 * `Number.isFinite(bar.close)` / `bar.close === x` see the **object**, not
 * the number — use `bar.close.current` or `+bar.close` for raw-number
 * contexts.
 *
 * @since <next-minor>
 * @example
 *     function delta(close: PriceSeries): number {
 *         return close - close[1]; // current minus one bar ago
 *     }
 */
export type PriceSeries = Price & Series<Price>;

/** Volume counterpart of {@link PriceSeries}. @since <next-minor> @example
 *     function vol(v: VolumeSeries): number { return v[0] + v[1]; } */
export type VolumeSeries = Volume & Series<Volume>;
```

Retype `Bar` fields (keep the existing per-field `@since 0.2` notes, append
a one-line "indexable as a series since <next-minor>"):

```ts
readonly open: PriceSeries;
readonly high: PriceSeries;
readonly low: PriceSeries;
readonly close: PriceSeries;
readonly volume: VolumeSeries;
readonly hl2: PriceSeries;
readonly hlc3: PriceSeries;
readonly ohlc4: PriceSeries;
readonly hlcc4: PriceSeries;
// time, symbol, interval, viewport, point UNCHANGED
```

Export `PriceSeries`/`VolumeSeries` from the package root (`packages/core/src/index.ts`)
alongside `Series`/`Price`/`Volume` if those are re-exported there.

### 2. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror the two new types and the `Bar` field retyping inside the shim's
`declare module` block (the same `Bar`, `Series`, `ScalarOrSeries` region near
lines 65–93). Keep them byte-for-byte consistent with core (lockstep
invariant). Update the `ScalarOrSeries` JSDoc example comment: note
`ta.ema(bar.close, 12)` still type-checks because `bar.close` (now
`PriceSeries`) is assignable to both `number` and `Series<number>`.

### 3. Type-level tests

- Core: extend `packages/core/src/types.types.test.ts` (expect-type) — assert
  `Bar["close"]` is assignable to `number` AND to `Series<number>`, that
  `bar.close[1]` is `number`, and `bar.close.current` is `number`.
- Compiler: add a positive `compile()` test (in the existing `compile.test.ts`
  alongside the "type-checks the request.security expression overload" test)
  with a fixture body using `const a = bar.close[1]; const b = bar.close * 2;
  plot(bar.close);` — assert it compiles with **no** type diagnostics. This is
  the guard that the shim retyping actually unblocks indexing (analysis-only
  `transformAndAnalyse` does not type-check, so it must be a `compile()` test).
- Update the `dynamic-series-index` fixture comment in
  `packages/compiler/src/api.test.ts` (lines ~397–413): it no longer needs to
  import `ta.ema` to get "a real `Series<number>`" — it can index `bar.close`
  directly. Adjust the fixture and comment accordingly while keeping the
  warning assertion intact (index with a non-literal to still trip
  `dynamic-series-index`).

### 4. Changeset

Create `.changeset/<slug>.md` (feature changeset for the whole work):

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
---

Make the bar's OHLCV + derived fields directly indexable as a series …
(describe `bar.close[1]`, the removal of the `ta.ema(_,1)` trick, and the
`Number.isFinite(bar.close)` / `=== ` migration to `.current` / `+`).
```

## Edge cases

- Intersection assignability: confirm `bar.close` flows into a
  `Series<number>` param (e.g. `ta.ema`) AND a `number` param (e.g.
  `bar.point(0, bar.close)`); both hold for an intersection.
- `time`/`symbol`/`interval` must remain unchanged — do not retype them.
- Keep `Series<T>` generic intact (used by `Series<ReadonlyArray<Bar>>` for
  `request.lowerTf`); only `Bar` fields change.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | Add `PriceSeries`/`VolumeSeries`; retype `Bar` fields. |
| `packages/core/src/index.ts` | Modify | Re-export new types if siblings are exported there. |
| `packages/core/src/types.types.test.ts` | Modify | expect-type assertions. |
| `packages/compiler/src/program.ts` | Modify | Mirror new types + `Bar` fields in shim; tweak `ScalarOrSeries` JSDoc. |
| `packages/compiler/src/compile.test.ts` | Modify | Positive `bar.close[1]` / `* 2` type-check test. |
| `packages/compiler/src/api.test.ts` | Modify | Update `dynamic-series-index` fixture + comment. |
| `.changeset/<slug>.md` | Create | Feature changeset (minor: core, compiler, runtime). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage; `types.ts`
  excluded from coverage but type-tests must pass)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since`, `@example`, stability)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime).

## Acceptance Criteria

- `PriceSeries`/`VolumeSeries` defined + exported with full JSDoc.
- `Bar` OHLCV + derived fields retyped; `time`/`symbol`/`interval` untouched.
- Shim in `program.ts` mirrors core exactly (lockstep).
- expect-type test proves dual scalar+series nature of `bar.close`.
- `compile()` test proves `bar.close[1]` and `bar.close * 2` type-check.
- `dynamic-series-index` fixture updated to index `bar.close` directly.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green.
