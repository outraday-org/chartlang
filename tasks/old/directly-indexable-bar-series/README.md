# Directly-indexable bar series

> Source-of-truth plan: `/Users/julianwaibel/.claude/plans/vivid-orbiting-sonnet.md`

## Overview

Make the bar's OHLCV + derived fields (`open, high, low, close, volume,
hl2, hlc3, ohlc4, hlcc4`) **directly indexable** as a `Series` from inside
`compute`, so scripts can write `bar.close[1]` instead of routing the
scalar through a `ta.ema(bar.close, 1)` identity trick to "republish" it as
an indexable series. Each field stays usable as a plain number too
(`bar.close * 2`, `plot(bar.close)`, `ta.ema(bar.close, 20)`), so the change
is additive for existing scripts at the value level.

This is a **unification**, not a new concept: the runtime already keeps a
`Float64RingBuffer` + `Series` proxy per field (`StreamState.seriesViews`),
the compiler's `extractMaxLookback` already counts `bar.close[N]` toward the
ring-buffer capacity, `ta.*` already accepts `ScalarOrSeries`, and the HTF
`SecurityBar` already exposes every OHLCV field as a `Series`. The only
missing piece is wiring the main `bar` fields to those existing views and
giving the views number-coercion so scalar usage keeps working.

References: `packages/runtime/CLAUDE.md` (§6.7 invariant), `packages/core/CLAUDE.md`,
`packages/compiler/CLAUDE.md` (core-shim lockstep), `scripts/CLAUDE.md`
(examples + skills generators).

## Current State

- `Bar.close` (and all OHLCV/derived fields) are scalar `Price`/`Volume`
  (`packages/core/src/types.ts`, mirrored in `packages/compiler/src/program.ts`).
- `bar.close[1]` is a **TypeScript error** today (a `number` has no index
  signature); scripts use `const src = ta.ema(bar.close, 1)` then `src[1]`.
- Runtime: `createStreamState` builds `ohlcv` ring buffers + `seriesViews`
  proxies for all 10 numeric fields, but `BarView` holds **scalar** copies
  mutated each bar by `appendBarToStream`/`replaceStreamHead`/`replaceTickHead`/
  `restoreFromSnapshot`.
- `makeSeriesView` (`packages/runtime/src/seriesView.ts`) proxies
  `current`/`length`/`[n]` but is **not** number-coercible.
- The "Manual SMA" demo (`apps/site/src/components/demo/scripts.ts`) and its
  generated docs (`docs/examples/manual-sma.md`) showcase the workaround;
  `docs/language/series-and-indexing.md` documents `bar.close` as "the scalar
  value."

## Target State

- `bar.close[1]`, `bar.open[2]`, `bar.volume[1]`, `bar.hl2[3]`, … type-check
  and read history directly; `bar.close.current` and `bar.close.length` work.
- Existing scalar usage (`bar.close * 2`, comparisons, `Math.*`, `plot`,
  `ta.*` source arg) is unchanged at the value level.
- The `ta.ema(_, 1)` identity trick is gone from the codebase; the Manual SMA
  demo, generated example docs, the series-and-indexing guide, and the
  chartlang-coding skill all show direct `bar.close[N]` indexing.
- Documented breaking idioms: `bar.close` is now an object, so
  `Number.isFinite(bar.close)` and `bar.close === x` change — use
  `bar.close.current` / `+bar.close`.
- `time`, `symbol`, `interval` stay scalar (timestamp axis is consumed as a
  raw number throughout the emit/draw pipeline; symbol/interval are strings).

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`PriceSeries = Price & Series<Price>` (intersection type)** | Verified with strict `tsc`: the `number & Series<number>` intersection supports arithmetic, comparison, `Math.*`, indexing `[n]`, `.current`, and assignment to a `Series<number>`/`ScalarOrSeries` param **simultaneously**. A plain `Series<number>` would break `bar.close * 2`; a plain `number` can't be indexed. |
| **Number-coerce the existing `makeSeriesView` proxy (`valueOf` + `Symbol.toPrimitive`)** | One small additive change makes every numeric series usable as a scalar. Harmless for non-numeric series (nothing coerces those). Reuses the single proxy rather than forking a parallel `makePriceSeriesView`. |
| **`bar.close` IS `seriesViews.close` (one identity per buffer)** | Drops the per-bar scalar copies in append/replace/restore (a net simplification) and keeps `bar.close === seriesViews.close`. |
| **`time` stays scalar** | `emission.time = ctx.stream.bar.time` and the draw/anchor pipeline consume time as a raw number; converting it would ripple through many emit sites for no script-author benefit. `bar.point` already uses scalar `bar.time`. |
| **`SecurityBar` left as-is** | Already `Series`-shaped; its runtime views inherit coercion for free. HTF `bar.close * 2` still needs `.current` at the type level — deferred (see Follow-Up). |
| **Accept the `Number.isFinite`/`===` break, migrate + document** | Pre-1.0; the ergonomic win outweighs the rare scalar-identity idioms. |

## Dependency Graph

```
Task 1 (core types + compiler shim + type tests)
  |
  v
Task 2 (runtime: coercible series view + bar wiring + tests + bench)
  |
  v
Task 3 (conformance scenario: direct bar.close[N] indexing)
  |
  v
Task 4 (demo + generated docs + guide prose + skills + CLAUDE.md)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core types + compiler shim](./1-core-types-and-compiler-shim.md) | core, compiler | None | Medium |
| 2 | [Runtime coercible bar series](./2-runtime-coercible-bar-series.md) | runtime | 1 | High |
| 3 | [Conformance: direct bar indexing](./3-conformance-direct-bar-index.md) | conformance | 2 | Low |
| 4 | [Demo, docs, skills](./4-demo-docs-skills.md) | apps/site, docs, skills | 1, 2 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `makeSeriesView` | `packages/runtime/src/seriesView.ts` | Extend with `valueOf`/`Symbol.toPrimitive`; do not fork. |
| `StreamState.seriesViews` | `packages/runtime/src/streamState.ts` | Point `bar.*` fields at these existing proxies. |
| `OHLCV_FIELDS` + `isSeriesShapedAccess` | `packages/compiler/src/analysis/extractMaxLookback.ts` | Already recognises `bar.close[N]`; **no change** needed. |
| `ScalarOrSeries` | `packages/core/src/types.ts` + `program.ts` shim | `bar.close` (now `PriceSeries`) is assignable to it; reuse for `ta.*` source args. |
| `SecurityBar` series shape | `packages/core/src/request/request.ts` | Mirror its precedent (OHLCV-as-series) on the main `Bar`. |
| `DEMO_SCRIPTS` + `gen-examples-docs.ts` | `apps/site/src/components/demo/scripts.ts`, `scripts/gen-examples-docs.ts` | Edit the demo source, then `pnpm examples:generate`; never hand-edit `docs/examples/*.md`. |
| `generate-skills-reference.ts` | `scripts/generate-skills-reference.ts` | `pnpm skills:generate` after editing skill text; `skills:gate` enforces. |

## Provenance

No `../invinite/` port — this is a chartlang-native ergonomics change.

## Deferred / Follow-Up Work

- Unify `SecurityBar` OHLCV fields to the same coercible `PriceSeries`/
  `VolumeSeries` type so HTF `bar.close * 2` works without `.current`.
- Optionally expose `bar.time` as a series (`bar.time[1]`) if a use case
  appears — requires migrating internal raw-number `bar.time` reads first.
