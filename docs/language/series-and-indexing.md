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

## Shifting output with the `ta` `offset` option

Indexing reads a prior value at one callsite. To shift an entire series
forward — so its `.current` reads the value from N bars ago on every
bar — pass the universal `opts.offset` to any `ta.*` primitive:

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "SMA Offset",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const sma = ta.sma(bar.close, 20);
        const shifted = ta.sma(bar.close, 20, { offset: 5 });
        // shifted.current === sma[5] on every bar.
        plot(sma, { title: "SMA(20)" });
        plot(shifted, { title: "SMA(20) offset 5" });
    },
});
```

`offset` lives on the `ta` call, not on `plot` — `plot` has no offset
option. A positive offset displaces the line to the right; the same
prior values stay reachable by indexing the unshifted series (`sma[5]`).

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

## Anchoring drawings by bar offset — `bar.point`

Drawings persist a single coordinate frame: a `WorldPoint` of
`{ time, price }`. Authoring an offset-relative anchor (e.g. "10 bars
ago") as an absolute timestamp is awkward, so `bar.point(offset, price)`
resolves an integer bar offset to the matching `WorldPoint` at compute
time. It is authoring sugar — it introduces no new anchor shape, and it
composes directly with every `draw.*` anchor argument.

```ts
import { defineDrawing } from "@invinite-org/chartlang-core";

export default defineDrawing({
    name: "tracking line",
    apiVersion: 1,
    compute({ bar, draw }) {
        // From the close 10 bars ago to the current close.
        draw.line(bar.point(-10, bar.close), bar.point(0, bar.close));
    },
});
```

Offset semantics, relative to the current bar:

- `bar.point(0, price)` — the current bar (`{ time: bar.time, price }`).
- `bar.point(-n, price)` — `n` bars back, using the **real** historical
  timestamp from the runtime's time history. If `n` exceeds retained
  history the time is `NaN` (graceful degradation, the same as a series
  lookback past history) — it never throws.
- `bar.point(n, price)` — `n` bars into the future. The bar does not
  exist yet, so the time is extrapolated as
  `lastTime + n * spacing`, where `spacing` is the median delta of the
  most recent retained bar times (falling back to the parsed bar interval
  when fewer than two bars are retained).

A **negative integer-literal** offset contributes to the script's
lookback exactly like `series[n]`, so the runtime sizes the time buffer
to retain enough depth — `bar.point(-10, …)` keeps ten bars of history.
Positive (future) offsets need no buffer depth, and a non-literal /
dynamic offset cannot be sized at compile time (reads past retention
return a `NaN` time, just like a dynamic series index).

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
