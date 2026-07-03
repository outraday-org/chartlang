# Worked examples

Four complete, compileable chartlang scripts, copied verbatim from the
`examples/scripts/` directory in the chartlang repo. Each example
demonstrates one specific contract detail; read the introduction before
the source, then read the source.

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
        plot(ta.ema(bar.close, inputs.length as number), {
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

## Cross-links

- `references/forbidden.md` — the constructs the compiler rejects.
- `references/primitives.md` — the full `ta.*` / `draw.*` signature
  reference.
- `examples/scripts/` in the chartlang repo — additional scripts
  (`fib-retracement`, `session-high-alert`, `daily-rsi-divergence`,
  `mintick-snapped-entry`) for `draw.*`, `state.*`, `timeframe.*`, and
  `syminfo.*` surfaces.
