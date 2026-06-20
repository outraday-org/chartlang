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

The bar's OHLCV + derived fields are series too — and you can index them
**directly**. `bar.close` is both a scalar (so `bar.close * 2`,
`plot(bar.close)`, and `ta.ema(bar.close, 20)` all work) and a
`Series<Price>` (so `bar.close[1]` is the close one bar ago and
`bar.close.current` is the current close). The same holds for `bar.open`,
`bar.high`, `bar.low`, `bar.volume`, and the pre-computed derived sources
(`bar.hl2`, `bar.hlc3`, `bar.ohlc4`, `bar.hlcc4`). There is no need to route
a price through a moving average to make it indexable.

```ts
// Mean of the last 5 closes, straight from the price series.
const sma5 = (bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) / 5;
```

::: warning Raw-number contexts
Because `bar.close` is now an object, a few number-only idioms behave
differently: `Number.isFinite(bar.close)` is always `false` (it does not
coerce) and `bar.close === 42` is `false` (object vs number). Use
`bar.close.current` or `+bar.close` when you need the raw scalar — for
example storing it in a `state.*` slot (`high.value = bar.high.current`) or
building a drawing anchor (`{ time: bar.time, price: bar.close.current }`).
Arithmetic, comparisons, `Math.*`, `plot(...)`, and `ta.*` sources all coerce
automatically, so they need no change.
:::

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

## Shifting where a series renders — the `ta` `offset` option

Indexing reads a prior value at one callsite. The universal `opts.offset`
on any `ta.*` primitive does something different: it shifts **where the
series renders** without changing its values. `offset` is a
presentation-only display shift in bars — a positive offset draws the
line to the **right** (future), a negative offset to the **left** (past):

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "SMA Offset",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.sma(bar.close, 20), { title: "SMA(20)" });
        plot(ta.sma(bar.close, 20, { offset: 5 }), { title: "SMA(20) +5" });
        plot(ta.sma(bar.close, 20, { offset: -5 }), { title: "SMA(20) −5" });
    },
});
```

The shift rides the plot emission as a signed `xShift` (see
[`PlotEmission`](../spec/emissions.md#plotemission)); an adapter renders
the series displaced by that many bars. The numeric series value is
**unshifted** — indexing, alerts, and `state.*` all see the value
computed at the current bar, both for positive and negative offsets.
`offset` lives on the `ta` call, not on `plot` — `plot` has no offset
option. `offset: 0` and the no-offset path are byte-identical.

> ALMA is the one exception: its `opts.offset` is the Gaussian-centre
> position, so ALMA's universal display shift lives on the distinct
> `opts.barShift` option instead.

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

## User-created series — `state.series`

`bar.*` OHLCV fields and `ta.*` outputs are series the runtime hands you.
`state.series(init)` lets a script mint **its own** writable, indexable
number series — the one capability the read-only built-ins do not give you.
The returned handle is both a writable scalar slot (like `state.float`) **and**
an indexable `Series<number>` (like `bar.close`):

- `s.value = expr` writes **this bar's** value (call it every step).
- `s.current` / `s[0]` / `+s` read the current head; `s[1]` is one bar ago,
  `s[3]` three bars ago; `s.length` is the filled count.
- The slot advances **once per bar automatically** — `s[1]` is always exactly
  one committed bar back. The allocation bar's pre-write head is seeded with
  `init`; a bar where you never write leaves a `NaN` gap (carry the previous
  value forward with `s.value = +s`).

::: warning Raw-number contexts
Like `bar.close`, the handle is an object, so `Number.isFinite(s)` is always
`false` and `s === 5` is `false` (object vs number). Use `s.current`, `+s`, or
`s.value` when you need the raw scalar.
:::

### Which do I reach for?

To index a built-in or a `ta.*` output, index it **directly** — `bar.close[3]`
and `ta.ema(bar.close, 14)[1]` already work, with **no** `state.series` needed.
Reach for `state.series` only when you need the history of a value **you**
compute that is **not** already a series — especially a **self-referential
recurrence** (a value defined in terms of its own prior bar) or a
**conditionally-updated** value. Those genuinely cannot be read off
`bar.close[N]`:

```ts
import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Up-close streak",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Consecutive up-closes: the value depends on its OWN prior bar, so it
        // can't be read off bar.close[N]. state.series both stores it and lets
        // you look back at the streak N bars ago.
        const streak = state.series(0);
        streak.value = bar.close.current > bar.close[1] ? streak[1] + 1 : 0;
        plot(streak.current, { title: "Up streak" });
    },
});
```

A `state.series` ring is bounded by the compiler's lookback analysis exactly
like every other series (see below), so a literal `s[n]` sizes its buffer
precisely. It is the writable sibling of the bar/`ta.*` series: same `[n]` /
`.current` / `+s` read surface, same NaN-gap rendering — the only delta is that
you write its values yourself.

## Lookback is bounded — dynamic indices are flagged

A series index that the compiler can **prove bounded at compile time** is
sized to the exact `maxLookback` — no warning, no fallback buffer. That
covers a literal (`series[3]`), a bounded-loop induction variable
(`for (let i = 0; i < N; i++) series[i]`), a `const` numeric literal
(`const k = 4; series[k]`), and any **affine combination** of those
(`series[i + 1]`, `series[K - i]`, `series[2 * i]`). A bounded `for` loop
is therefore a first-class way to express a rolling window — the loop
form of an unrolled `series[0] + … + series[N]` sizes its buffer
identically.

A **genuinely dynamic** index — one the compiler cannot bound, such as an
unbounded variable, an unsupported operator, or a value derived at
runtime — is a compiler warning (`dynamic-series-index`) and forces the
runtime to allocate a 5000-slot dynamic fallback buffer. Idiomatic
chartlang keeps indices provably bounded so the runtime can size buffers
tightly.

The runtime treats `manifest.seriesCapacities` as a hard bound: even
under a dynamic-index warning, history does not grow without limit.
Out-of-range reads return `NaN` for numeric series.

## Cross-links

- The canonical rules: [Execution semantics § Series and indexing](../spec/semantics.md#series-and-indexing).
- Plot gap rendering: [Emission payloads § PlotEmission](../spec/emissions.md#plotemission).
- Warmup tags appear on each TA primitive page under
  [TA primitives](../primitives/ta/).
