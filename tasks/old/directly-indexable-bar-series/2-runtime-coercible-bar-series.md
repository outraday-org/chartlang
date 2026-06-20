# Task 2 — Runtime: coercible series view + bar wiring

> **Status: DONE**

## Goal

Make the runtime `bar.*` OHLCV + derived fields the already-existing
number-coercible `Series` views, so `bar.close[1]` reads history at runtime
while `bar.close * 2` / `plot(bar.close)` keep working. Extend `makeSeriesView`
with number coercion, point `BarView` fields at `seriesViews`, drop the now
redundant per-bar scalar copies, audit internal raw-number reads, and keep the
100% coverage + §6.7 property + bench gates green.

## Prerequisites

Task 1 (core `PriceSeries`/`VolumeSeries` types + retyped `Bar`).

## Current Behavior

- `makeSeriesView` (`packages/runtime/src/seriesView.ts`) proxies
  `current`/`length`/`[n]`; **not** number-coercible.
- `BarView` (`packages/runtime/src/streamState.ts`) holds scalar
  `open/high/low/close/volume/hl2/hlc3/ohlc4/hlcc4` mutated each bar by
  `appendBarToStream`, `replaceStreamHead`, `replaceTickHead`, and
  `restoreFromSnapshot`.
- `seriesViews.*` proxies already exist over the same `ohlcv` ring buffers but
  are separate from `bar`.
- §6.7 property test (`onBarClose.test.ts`) pins `bar.X === series.X[0]`.

## Desired Behavior

- `bar.close === stream.seriesViews.close` (one identity per buffer);
  `bar.close[1]` reads one bar ago; `+bar.close === ohlcv.close.at(0)`.
- No per-bar scalar copies for the 9 numeric fields (the proxy reads the buffer
  live). `time`/`symbol`/`interval` stay scalar and keep their writes.
- Every numeric series (bar fields, `ta.*` outputs, security fields) is number-
  coercible; behavior is unchanged for code that reads `.current` / indexes.

## Requirements

### 1. Coercible series view (`packages/runtime/src/seriesView.ts`)

Extend the `makeSeriesView` proxy `get` trap (additive — keep existing branches
and ordering):

```ts
get(_target, prop) {
    if (prop === "current") return buf.at(0);
    if (prop === "length") return buf.length;
    if (prop === "valueOf") return () => buf.at(0);
    if (prop === Symbol.toPrimitive) return (_hint: string) => buf.at(0);
    if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0) return buf.at(n);
    }
    return undefined;
},
has(_target, prop) {
    if (prop === "current" || prop === "length") return true;
    if (prop === "valueOf" || prop === Symbol.toPrimitive) return true;
    if (typeof prop === "string") { /* unchanged numeric branch */ }
    return false;
},
```

Update the JSDoc to document number coercion (`view * 2` → `buf.at(0)`).
`makeShiftedSeriesView` delegates to `makeSeriesView`, so it inherits coercion —
no change there, but confirm the offset side-table still works (coercion does
not record/disturb the `WeakMap`).

### 2. Bar wiring (`packages/runtime/src/streamState.ts`)

- **`BarView` type**: retype the 9 numeric fields to `PriceSeries` /
  `VolumeSeries` (import from core). Keep `time: number`, `symbol`,
  `interval`, `viewport`, `point` as-is.
- **`createStreamState`**: build `ohlcv`, then `seriesViews`, then `bar` with
  `open: seriesViews.open, …, volume: seriesViews.volume`. The pre-first-bar
  state is naturally `NaN`/empty (buffers start empty → `at(0)` returns NaN), so
  the old explicit `Number.NaN` seeds for those fields are dropped. Keep
  `time: 0`, `symbol`, `interval`, `viewport`, and the `point` closure (it uses
  scalar `bar.time`/`bar.interval` — unchanged).
- **`appendBarToStream` / `replaceStreamHead` / `replaceTickHead`**: keep the
  `ohlcv.*.append`/`.replaceHead` calls and the `deriveBarSources` computation
  feeding the buffers. **Delete** the `bar.open = … / bar.close = … / bar.hl2 =
  …` scalar assignments for the 9 fields. Keep `bar.time`, `bar.symbol`,
  `bar.interval` writes (and the tick path's no-time/open invariant —
  `replaceTickHead` still must not touch `time`/`open` buffers).
- **`restoreFromSnapshot`**: delete the 9 `bar.X = valueAt(...)` / derived
  `bar.hl2 = …` scalar assignments (both empty and non-empty branches — the
  views read the restored buffers live). Keep `bar.time` and `bar.interval`
  writes. The `recomputeDerivedBuffers` call (which repopulates the derived
  ring buffers) stays.

### 3. Internal raw-number audit

Grep runtime + host + adapter + conformance for direct raw-number reads of the
9 fields and fix any that need a scalar / finite-check / spread:

```
grep -rn "bar\.\(open\|high\|low\|close\|volume\|hl2\|hlc3\|ohlc4\|hlcc4\)" \
  packages/runtime/src packages/host-* packages/adapter-kit examples/canvas2d-adapter
grep -rn "isFinite(bar\.\|{ \.\.\.\?bar\b\|Object.keys(bar" packages
```

- `plot` (`emit/plot.ts`) reads `ctx.stream.bar.time` (scalar — safe) and routes
  values through `resolveValue` (`typeof === "number" ? value : value.current`)
  — a coercible series object takes the `.current` path, value-identical.
- Any internal `Number.isFinite(bar.close)` / `bar.close === …` → switch to
  `bar.close.current` / `+bar.close` / `ohlcv.close.at(0)`.
- Confirm nothing spreads or `Object.keys`-es `bar` expecting own enumerable
  numeric fields (proxy fields are not own-enumerable).

### 4. Tests (co-located; keep 100% coverage)

- `seriesView.test.ts`: cover the new `valueOf` + `Symbol.toPrimitive` branches
  (coverage gate) — assert `view * 2`, `view + 1`, `` `${view}` ``, `Math.max`,
  and that `view[1]` / `view.current` still work. Cover `has` for the two new
  keys.
- `streamState.test.ts`: `bar.close === seriesViews.close`; after appends,
  `bar.close[1]` equals the prior close and `+bar.close === ohlcv.close.at(0)`;
  tick path updates close-side but not time/open; restore path leaves the views
  reading restored buffers (no scalar copy). Update any existing assertions that
  read `bar.close` as a raw number to coerce (`+bar.close` / `.current`).
- `onBarClose.test.ts` §6.7: change `bar.X === series.X[0]` to
  `+bar.X === series.X[0]` (or `bar.X.current === series.X[0]`) for the 9 fields;
  the `time` assertion stays as-is. Keep the "all series equal length" prop.
- `onBarTick.test.ts` / `drain.test.ts`: re-run; adjust any raw-number bar reads.
- `bench`: run `pnpm -F @invinite-org/chartlang-runtime bench`. The proxy
  `Symbol.toPrimitive` path is now on the arithmetic hot path. If a
  `*.bench.test.ts` `THRESHOLD_MS` regresses, specialize the bar-field views
  (plain object with `valueOf` + getters + a Proxy only for `[n]`, or a tuned
  trap order); otherwise leave the unified proxy. Document the outcome in the
  PR.

## Edge cases

- Warmup: before the first bar, `bar.close[0]` / `+bar.close` are `NaN`
  (empty buffer) — matches the old scalar `NaN` seed.
- `bar.close[n]` past retained history is `NaN` (ring-buffer `at` contract).
- Coercion must return `buf.at(0)` (current), not a stale snapshot, so
  `plot(bar.close)` and arithmetic always see the live head (incl. mid-tick).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/seriesView.ts` | Modify | Add `valueOf`/`Symbol.toPrimitive` coercion. |
| `packages/runtime/src/streamState.ts` | Modify | Retype `BarView`; wire fields to `seriesViews`; drop scalar copies. |
| `packages/runtime/src/seriesView.test.ts` | Modify | Coercion branch coverage. |
| `packages/runtime/src/streamState.test.ts` | Modify | Identity + history + restore assertions. |
| `packages/runtime/src/onBarClose.test.ts` | Modify | §6.7 coerced assertions. |
| `packages/runtime/src/onBarTick.test.ts`, `drain.test.ts` | Modify (if needed) | Adjust raw-number reads. |
| Internal raw-number read sites (per audit) | Modify | `.current` / `+` / `ohlcv.at(0)`. |

## Gates

- `pnpm -F @invinite-org/chartlang-runtime test` (coverage **100%**)
- `pnpm -F @invinite-org/chartlang-runtime bench` (no `THRESHOLD_MS` regression)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (runtime is included as minor).

## Acceptance Criteria

- `makeSeriesView` proxy is number-coercible; branches fully covered.
- `bar.close` (and the 8 others) is the corresponding `seriesViews` proxy;
  `bar.close[1]` works; `+bar.close === ohlcv.close.at(0)`.
- Per-bar scalar copies for the 9 fields removed from append/replace/restore;
  `time`/`symbol`/`interval` writes retained; tick no-time/open invariant kept.
- Internal raw-number reads audited and fixed.
- §6.7 props updated and green; "all series equal length" still holds.
- Runtime coverage 100%; benches within threshold (or views specialized).
