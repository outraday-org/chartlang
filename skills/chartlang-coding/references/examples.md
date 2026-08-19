# Worked examples

Complete, compileable chartlang scripts, copied verbatim from the
`examples/scripts/` directory in the chartlang repo. Each example
demonstrates one specific contract detail; read the introduction before
the source, then read the source.

This file is **self-contained** — everything you need to write a script is
below. Do not go looking for the source directory: most surfaces that host
this skill have no filesystem access to the chartlang repo at all.

## 1. EMA cross with alert

Demonstrates the canonical indicator pattern: top-level imports +
destructured `compute`, two `ta.ema(...)` plots, and an `alert(...)`
gated on `ta.crossover(...).current`. This is the smallest script that
exercises plots and alerts together.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        if (ta.crossover(fast, slow).current) {
            alert("EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (ta.crossunder(fast, slow).current) {
            alert("EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
});
```

Note the `.current` on `ta.crossover(fast, slow).current`. The
crossover helper returns a `Series<boolean>`, not a boolean — without
`.current`, the `if` would always be truthy.

## 2. Bollinger bands

Demonstrates a primitive that returns a record of series (`ta.bb`'s
`{ upper, middle, lower }`) and plots each one separately. Note the
optional third argument is an object literal with a `multiplier`
field — the compiler reads option literals statically.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger Bands",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const bands = ta.bb(bar.close, 20, { multiplier: 2 });
        plot(bands.upper, { color: "#cccccc", title: "BB Upper", lineWidth: 1 });
        plot(bands.middle, { color: "#90caf9", title: "BB Middle", lineWidth: 2 });
        plot(bands.lower, { color: "#cccccc", title: "BB Lower", lineWidth: 1 });
    },
});
```

Every `plot(...)` carries a `title` — required for downstream
indicators to read it via `.output("title")`, and useful for the
chart's settings UI even when no consumer is attached.

## 3. RSI divergence alert

Demonstrates `hline(...)` for static horizontal levels alongside a
plotted oscillator, plus two alert routes with distinct severities.
The script is a sub-pane indicator (`overlay: false`) — the host
mounts it in its own pane below the price chart.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { alert, defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "RSI Divergence Alert",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline, alert }) {
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { color: "#9c27b0", title: "RSI(14)" });

        hline(70, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(30, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });

        if (ta.crossunder(rsi, 70).current) {
            alert("RSI dropped below 70 (overbought exit)", { severity: "warning" });
        }
        if (ta.crossover(rsi, 30).current) {
            alert("RSI rose above 30 (oversold exit)", { severity: "info" });
        }
    },
});
```

`hline(...)` takes a numeric level, not a series. It is emitted once
per mount, not per bar.

## 4. Indicator composition

Demonstrates the two-file producer/consumer pattern. The producer
exports a single titled `plot(...)` via `inputs.length`; the consumer
imports the producer, binds two `withInputs(...)` variants, reads each
via `.output("line")`, and renders a confirmed-cross marker.

**Producer — `base-trend.chart.ts`:**

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(50, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length), {
            title: "line",
            color: "#3b82f6",
        });
    },
});
```

**Consumer — `trend-confirmation.chart.ts`:**

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

const fastTrend = baseTrend.withInputs({ length: 20 });
const slowSource = baseTrend.withInputs({ length: 100 });

export const slowTrend = defineIndicator({
    name: "Trend Slow",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) {
        const slow = slowSource.output("line");
        plot(slow.current, { title: "line", color: "#9ca3af" });
    },
});

export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.close, { title: "Confirmed cross", color: "#22c55e" });
        }
    },
});
```

Three indicators are declared in the consumer file:

- `fastTrend` — a private `const` (no export). The host runs it every
  bar as a data dependency, but its `plot(...)` calls are dropped
  before they reach the adapter.
- `slowTrend` — an `export const`. The host mounts it as a sibling and
  renders it under the `export:slowTrend/` slot-id prefix.
- The default export — the primary indicator, reads both bindings via
  `.output("line")`.

The compiled sidecar is a `ReadonlyArray<ScriptManifest>` because the
file has more than one drawn indicator. The host runs
`Array.isArray(manifest)` to branch on single vs multi-export shape.

## 5. Heikin-Ashi candles (`plotcandle`)

A derived candle series. Each bar's Heikin-Ashi open folds the prior HA
open/close, so the two feed forward through `state.series`; the result is
drawn with `plotcandle` (its own OHLC quad, not a recolor of the chart
candles). On the first bar the HA open seeds to `(open + close) / 2`.

```ts
import { defineIndicator, plotcandle, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Heikin-Ashi",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plotcandle, state }) {
        const haOpenSeries = state.series(NaN);
        const haCloseSeries = state.series(NaN);

        const o = bar.open.current;
        const h = bar.high.current;
        const l = bar.low.current;
        const c = bar.close.current;

        const haClose = (o + h + l + c) / 4;
        const prevOpen = haOpenSeries[1];
        const prevClose = haCloseSeries[1];
        const haOpen = Number.isNaN(prevOpen) ? (o + c) / 2 : (prevOpen + prevClose) / 2;
        const haHigh = Math.max(h, haOpen, haClose);
        const haLow = Math.min(l, haOpen, haClose);

        haOpenSeries.value = haOpen;
        haCloseSeries.value = haClose;

        plotcandle(haOpen, haHigh, haLow, haClose, { bull: "#26a69a", bear: "#ef5350" });
    },
});
```

`haOpenSeries[1]` reads the prior bar's committed HA open (`NaN` on the
first bar, which selects the seed branch); `haOpenSeries.value = …` writes
this bar's head so the next bar can read it back. Adapters that do not
declare the `candle` capability drop the emission silently.

## 6. Order signals (`order.*`)

Demonstrates the structured trade-signal surface: `order.buy` / `order.close`
market intents guarded on `order.position()`, with **no drawing code at all** —
each accepted order additionally emits an `arrow` (and, because both calls pass
a `label`, a `label`) plot through the pipeline every adapter already renders.

The two things to take from it: `order.position()` reads the position as of the
**previous** confirmed step (orders fold after `compute` returns, reproducing
Pine's `strategy.position_size` lag), and the `ta.*` calls plus the position
read are **hoisted out of the `if`s** — a stateful `ta.*` callsite evaluated
only on some bars desyncs its own history.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Order EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        // Hoist both crossing tests and the position read OUT of the `if`s.
        // A stateful `ta.*` callsite evaluated only on some bars desyncs its own
        // history, and hoisting the position read leaves the one-fold lag as the
        // single thing the branches depend on.
        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;

        // `order.position()` reads the position as of the PREVIOUS confirmed
        // step — the runtime folds a bar's orders after `compute` returns, which
        // reproduces Pine's `strategy.position_size` lag. So this is "flat or
        // short going into this bar", and it is what keeps a run of consecutive
        // crossovers from stacking a second entry on an open long.
        const flatOrShort = order.position().size <= 0;

        if (flatOrShort && up) {
            order.buy({ label: "Long" });
        }
        if (!flatOrShort && down) {
            order.close({ label: "Exit" });
        }

        // No drawing code anywhere: each accepted order additionally emits an
        // `arrow` plot (and a `label` plot, since both calls pass one) through
        // the plot pipeline every adapter already renders. `marker: false` opts
        // out — see `order-silent-markers.chart.ts`.
    },
});
```

chartlang tracks only a **nominal** position — `avgPrice` is the signal bar's
close, and there is no capital, slippage, commission, or P&L. Whatever consumes
`RunnerEmissions.orders` owns the economics, typically filling at the next
bar's open. Never carry a trade signal in an `alert(...)` message.

## 7. Swing-high ray (`draw.*`)

Demonstrates the drawing surface: `ta.pivotsHighLow` for swing detection,
`bar.point(-n, price)` to resolve a confirmed pivot's real historical
timestamp, and the **per-bar re-emit → one handle** idiom that keeps a single
ray moving instead of stacking a new one every bar. Note `maxDrawings`, which
declares the script's own per-bucket drawing budget.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot High Ray",
    apiVersion: 1,
    overlay: true,
    // One ray, reused across every bar (see below), so a single "lines"
    // slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Swing-high detection: a bar whose high tops the 5 bars on each
        // side. A pivot can only be *confirmed* once the 5 bars to its
        // right exist, so `pivots.high.current` turns non-NaN 5 bars late
        // and reports the high from 5 bars back.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });

        // `state.*` slots persist across bars (Pine `var`). Remember the
        // latest pivot high's price AND time so we can keep drawing from
        // it on every later bar — this is the "track the last high" part.
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);

        if (!Number.isNaN(pivots.high.current)) {
            // The confirmed pivot sits 5 bars back. `bar.point(-5, …)`
            // resolves that offset to the real historical timestamp from
            // the runtime's time buffer — no hand-rolled time series. The
            // offset literal must stay in sync with `rightLength` above (a
            // negative integer literal is what sizes the lookback buffer).
            const anchor = bar.point(-5, pivots.high.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }

        // Once a high is known, draw a horizontal ray from it to the right
        // edge. Calling `draw.horizontalRay` every bar from this same line
        // of source reuses one drawing handle — the runtime emits an
        // `update`, not a new ray — so the single line simply jumps to each
        // new swing high as it is confirmed.
        if (!Number.isNaN(lastPrice.value)) {
            draw.horizontalRay(
                { time: lastTime.value, price: lastPrice.value },
                { color: "#ef5350", lineWidth: 2, lineStyle: "dashed" },
            );
        }
    },
});
```

The re-emit idiom is the thing to take from it: a `draw.*` callsite is keyed
by its **source position**, so calling it once per bar from the same line
updates one drawing. Emitting from a loop, or from two different lines, gives
you one handle per callsite and burns the `maxDrawings` budget.

## 8. Session high alert (`barstate` + `state.*`)

Demonstrates the `barstate` namespace and a running level held in a
`state.float` slot: reset the high at the session open, extend it otherwise,
plot it, and alert on a crossover. `barstate.isfirst` is how you special-case
the very first bar without a counter.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Session High" — running highest high
// reset on session open, alerts on crossover. Translated from
// public Pine documentation idioms (no specific source SHA).

import { alert, defineIndicator, input, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session High Alert",
    apiVersion: 1,
    overlay: true,
    inputs: {
        alertOnCross: input.bool(true, { title: "Alert on cross" }),
    },
    compute({ bar, state, alert, plot, ta, barstate, inputs }) {
        const high = state.float(Number.NaN);
        const isSessionOpen = barstate.isfirst || bar.time % 86_400_000 === 0;
        if (isSessionOpen) {
            high.value = bar.high;
        } else if (Number.isNaN(high.value) || bar.high > high.value) {
            high.value = bar.high;
        }
        plot(high.value, { color: "#ff9900", title: "Session high" });
        if (inputs.alertOnCross && ta.crossover(bar.close, high.value).current) {
            alert("Close crossed session high", { severity: "info" });
        }
    },
});
```

Note that `ta.crossover(...)` is called unconditionally and only its
`.current` is read inside the `if` — a stateful `ta.*` callsite evaluated on
only some bars desyncs its own history, the same rule §6 states for `order.*`.

## Cross-links

- `references/forbidden.md` — the constructs the compiler rejects.
- `references/primitives.md` — the full `ta.*` / `draw.*` signature
  reference.

Every script above is copied verbatim from `examples/scripts/` in the
chartlang repo, which holds further variations on the same surfaces —
`fib-retracement`, `daily-rsi-divergence` and `mintick-snapped-entry` for
`draw.*` / `timeframe.*` / `syminfo.*`, and `order-rsi-reversal`
(signed-position reversal with `qty`) plus `order-silent-markers`
(`marker: false` and a hand-drawn glyph) for the rest of `order.*`. They add
no contract this file does not already state, so treat them as provenance,
not as reading you owe.
