---
title: "Pine to chartlang migration guide"
since: "0.6"
status: "stable"
---

# Pine to chartlang migration guide

> **Audience:** Pine v6 authors porting indicators, drawings, alerts, inputs,
> state, sessions, and multi-timeframe scripts to chartlang.

## High-level mental model

Pine runs a script once per bar and exposes implicit global series such as
`close`, `high`, and `bar_index`. chartlang keeps the same per-bar execution
model but makes the host boundary explicit: your script exports
`defineIndicator`, `defineDrawing`, `defineAlert`, or `defineAlertCondition`,
and receives a `compute(ctx)` callback. Market data lives on `ctx.bar` and
series views such as `ctx.close` are exposed through runtime primitives.

Inputs are declared up front in the manifest instead of being constructed
inside `compute`. That lets hosts render settings without executing user code.
State that Pine stores with `var` maps to `state.*` slots, and tick-only state
maps to `state.tick.*`. Multi-timeframe data is requested through
`request.security` for higher-timeframe aligned values and `request.lowerTf`
for lower-timeframe buckets.

## Worked Examples

### 1. Indicators - EMA Crossover

**Pine v6 source:**

```pine
//@version=6
indicator("EMA Crossover", overlay=true)
fastLen = input.int(9)
slowLen = input.int(21)
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
plot(fast)
plot(slow)
```

**chartlang equivalent:**

```ts
import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA Crossover",
    apiVersion: 1,
    inputs: {
        fastLen: input.int(9, { min: 1 }),
        slowLen: input.int(21, { min: 1 }),
    },
    compute({ bar, inputs }) {
        plot(ta.ema(bar.close, inputs.fastLen as number));
        plot(ta.ema(bar.close, inputs.slowLen as number));
    },
});
```

### 2. Drawings - Labeled Range

`box.new` and `label.new` map to `draw.rectangle` and `draw.text` or
`draw.marker`. Drawing calls return handles that can be updated on later bars.

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Range Box",
    apiVersion: 1,
    compute({ bar, draw }) {
        draw.rectangle(
            { time: bar.time - 50 * 60_000, price: bar.low },
            { time: bar.time, price: bar.high },
            { color: "#38bdf8" },
        );
        draw.text({ time: bar.time, price: bar.high }, "range");
    },
});
```

### 3. Alerts - RSI Cross

Use `defineAlertCondition` when hosts need a named condition, and `alert` for
direct runtime messages.

```ts
import { defineAlertCondition, ta } from "@invinite-org/chartlang-core";

export default defineAlertCondition({
    name: "RSI Cross",
    apiVersion: 1,
    conditions: {
        rsi70: {
            title: "RSI crossed 70",
            description: "RSI moved above 70",
            defaultMessage: "RSI crossed 70",
        },
    },
    compute({ bar, signal }) {
        signal?.("rsi70", ta.crossover(ta.rsi(bar.close, 14), 70));
    },
});
```

### 4. Inputs - Typed Manifest Values

Pine `input.int`, `input.string`, `input.source`, and `input.timeframe` map to
`input.int`, `input.string`, `input.source`, and `input.interval`. Declare them
in the `inputs` object and read resolved values from `ctx.inputs`.

### 5. State - Pine `var`

Use `state.float`, `state.int`, `state.bool`, or `state.string` for committed
bar state. Use `state.tick.*` when tick replacement should be visible before a
bar closes.

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Running Volume",
    apiVersion: 1,
    compute({ bar, plot, state }) {
        const total = state.float(0);
        total.set(total.current + bar.volume);
        plot(total.current);
    },
});
```

### 6. Multi-Timeframe - HTF and LTF

`request.security({ interval: "1D" })` returns aligned higher-timeframe
series. `request.lowerTf({ interval: "30s" })` returns a
`Series<ReadonlyArray<Bar>>`; each current value is the lower-timeframe bars
contained by the current main bar.

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MTF Count",
    apiVersion: 1,
    compute({ plot, request }) {
        const daily = request.security({ interval: "1D" });
        const ltf = request.lowerTf({ interval: "30s" });
        plot(daily.close.current);
        plot(ltf.current.length);
    },
});
```

## Feature Matrix

| Pine v6 surface | chartlang equivalent | Notes |
|---|---|---|
| `indicator` | `defineIndicator` | Manifest-first script declaration. |
| `alertcondition` | `defineAlertCondition` | Named host-visible conditions. |
| `alert` | `alert` | Runtime alert emission. |
| `input.int` / `input.float` / `input.bool` | `input.int` / `input.float` / `input.bool` | Declared in `inputs`. |
| `input.string` / `input.source` / `input.timeframe` | `input.string` / `input.source` / `input.interval` | Resolved through `ctx.inputs`. |
| `ta.sma`, `ta.ema`, `ta.rsi`, `ta.macd`, `ta.atr` | `ta.*` | Core technical-analysis namespace. |
| Bollinger, Donchian, Keltner, Ichimoku | `ta.bb`, `ta.donchian`, `ta.keltner`, `ta.ichimoku` | Structured results where needed. |
| Volume profile primitives | `ta.visibleRangeVolumeProfile`, `ta.fixedRangeVolumeProfile`, `ta.anchoredVolumeProfile`, `ta.sessionVolumeProfile` | Added before this guide in 0.5. |
| `plot`, `hline` | `plot`, `hline` | Options objects replace positional styling. |
| `plotshape`, `plotchar`, `plotarrow`, `bgcolor`, `barcolor` | plot kinds and emissions | Adapter capability gated. |
| `line.new`, `box.new`, `label.new`, tables | `draw.*`, `draw.table` | Handles update and remove drawings. |
| `var`, `varip` | `state.*`, `state.tick.*` | Explicit state slots. |
| `na`, `nz` | `Number.NaN`, `ta.nz` | Watch JavaScript NaN comparison semantics. |
| `request.security` | `request.security` | HTF values aligned to main bars. |
| `request.security_lower_tf` | `request.lowerTf` | Returns contained LTF bar arrays. |
| `dayofweek`, `weekofyear` | `weekday`, `weekKey` from `/time` | Explicit timezone parameter. |
| `session.ismarket` | `session.isOpen` from `/time` | Regular and extended sessions. |
| `color.new`, `color.rgb`, gradients | `color.withAlpha`, `color.rgb`, `color.fromGradient` | CSS color strings are accepted. |
| `runtime.*` debugging | `runtime.log.*`, `runtime.error` | Capability gated by adapters. |
| `strategy.entry`, `strategy.exit`, `strategy.close` | Not supported | Strategy execution is outside the OSS 0.6 surface. |
| Webhook payload delivery | Not supported in core | Adapters may provide their own alert transports. |
| Pine libraries | ES modules | Use normal TypeScript module boundaries. |

> Warning: Pine's implicit globals and chartlang's explicit context have the
> same per-bar intent but different code shape. Prefer moving declarations to
> the manifest instead of reconstructing Pine's global style.

## Audit Checklist

The task work-product in `tasks/phase-6-tier3-ltf/audit/` contains five port
traces:

| # | Pine script | Port trace | Coverage |
|---|---|---|---|
| 1 | RSI strategy-style indicator | `1-rsi-strategy.md` | Indicator and unsupported strategy callout |
| 2 | SMA cross alert | `2-sma-cross-alert.md` | Alert conditions |
| 3 | MTF trend filter | `3-mtf-trend-filter.md` | HTF and LTF requests |
| 4 | Volume-profile support/resistance | `4-vp-sr.md` | Volume-profile primitives |
| 5 | Session VWAP | `5-session-vwap.md` | `/time` session helpers |
