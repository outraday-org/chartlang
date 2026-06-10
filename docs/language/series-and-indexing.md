# Series and indexing

`Series<T>` is the read-only view over bounded runtime history that
scripts read inside `compute`. The canonical rules — buffer sizing,
warmup, NaN, indexing — are normative in
[Execution semantics § Series and indexing](../spec/semantics.md#series-and-indexing).
This page is the narrative tour with code.

## The `Series<T>` shape

The script-visible type is small:

```ts
type Series<T> = {
    readonly current: T;
    readonly [n: number]: T;
    readonly length: number;
};
```

- `series.current` and `series[0]` are the value at the current bar.
- `series[n]` for positive integer `n` is the value `n` bars ago.
- `series.length` is the number of filled slots so far, capped by the
  ring-buffer capacity the runtime allocated.
- Negative indices are out of range.

OHLCV inputs are series too — `bar.close` you receive each step is the
scalar value, but `ta.*` primitives that take a closing-price series read
the underlying `Series<Price>`. The pre-computed derived sources
(`bar.hl2`, `bar.hlc3`, `bar.ohlc4`, `bar.hlcc4`) follow the same shape.

## Reading the current and prior bars

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Close delta",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const ema = ta.ema(bar.close, 14);
        const delta = ema.current - ema[1];
        plot(delta, { title: "EMA delta" });
    },
});
```

The compiler walks every literal lookback and records the maximum into
`manifest.maxLookback`. The runtime sizes main numeric ring buffers to
at least `maxLookback + 1` slots. A script that never looks back still
has room for the current bar.

## Warmup and NaN

Every `ta.*` primitive declares a warmup window. `ta.ema(_, n)` returns
`NaN` for the first `n - 1` bars; `ta.rsi(_, n)` warms over its `n`-bar
window; `ta.macd` warms over the longer of its two EMAs. The primitive
reference pages under [TA primitives](../primitives/ta/) carry each
window in the `@warmup` line.

During warmup, numeric series read as `NaN`. Plots whose value is `NaN`
(or `+Infinity` / `-Infinity`) are emitted with `value: null` and
adapters render them as gaps, not as zeroes.

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA(50) — warmed by bar 49",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const ema = ta.ema(bar.close, 50);
        // ema.current is NaN for the first 49 bars — the plot is a gap.
        plot(ema, { title: "EMA(50)" });
    },
});
```

## Numeric semantics

`Series<number>` values use IEEE-754 binary64. NaN propagates through
arithmetic per the JS standard. There is no decimal or fixed-point
arithmetic layer in `apiVersion: 1`. Crossover-style boolean helpers
have special NaN handling documented on their own pages.

Object-valued series (such as `request.lowerTf`, which is a
`Series<ReadonlyArray<Bar>>`) use empty frozen arrays for out-of-range
or unsupported reads.

## Lookback is bounded — dynamic indices are flagged

Series indices must be literal integers. A dynamic index such as
`series[i]` is a compiler warning (`dynamic-series-index`) and forces
the runtime to allocate a 5000-slot dynamic fallback buffer. Idiomatic
chartlang sticks to literal lookback so the runtime can size buffers
tightly.

The runtime treats `manifest.seriesCapacities` as a hard bound: even
under a dynamic-index warning, history does not grow without limit.
Out-of-range reads return `NaN` for numeric series.

## Cross-links

- The canonical rules: [Execution semantics § Series and indexing](../spec/semantics.md#series-and-indexing).
- Plot gap rendering: [Emission payloads § PlotEmission](../spec/emissions.md#plotemission).
- Warmup tags appear on each TA primitive page under
  [TA primitives](../primitives/ta/).
