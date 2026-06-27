---
title: "Pine to chartlang migration guide"
since: "0.6"
revised: "1.0"
status: "stable"
---

# Pine to chartlang migration guide

> **Audience:** Pine v6 authors porting indicators, drawings, alerts, inputs,
> state, sessions, and multi-timeframe scripts to chartlang.

## High-level Mental Model

Pine runs a script once per bar and exposes implicit global series such as
`close`, `high`, and `bar_index`. chartlang keeps the same per-bar execution
model but makes the host boundary explicit: a script exports
`defineIndicator`, `defineDrawing`, `defineAlert`, or `defineAlertCondition`,
and receives a `compute(ctx)` callback. Market data lives on `ctx.bar`, and
historical series are exposed by explicit primitives such as `ta.*` and
`request.*`.

Inputs are declared up front in the manifest instead of being constructed
inside `compute`. Hosts can render settings without executing user code.
State that Pine stores with `var` maps to `state.*` slots, and tick-persistent
state maps to `state.tick.*`. Multi-timeframe data is requested through
`request.security` for higher-timeframe aligned values and `request.lowerTf`
for lower-timeframe buckets.

chartlang is not a Pine transpiler. The migration unit is a Pine idiom:
identify the distinct pattern, then map it to a chartlang primitive, an
explicit spec rule, or a documented 1.0 gap.

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
        const fast = ta.ema(bar.close, inputs.fastLen as number);
        const slow = ta.ema(bar.close, inputs.slowLen as number);
        plot(fast, { title: "Fast" });
        plot(slow, { title: "Slow" });
    },
});
```

### 2. Drawings - Labeled Range

`box.new` and `label.new` map to `draw.rectangle` and `draw.text` or
`draw.marker`. Drawing calls return handles that can be updated or removed in
later bars.

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Range Box",
    apiVersion: 1,
    compute({ bar, draw }) {
        const box = draw.rectangle(
            { time: bar.time - 50 * 60_000, price: bar.low },
            { time: bar.time, price: bar.high },
            { color: "#38bdf8" },
        );
        box.update({ style: { fillColor: "#38bdf833" } });
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
        signal?.("rsi70", ta.crossover(ta.rsi(bar.close, 14), 70).current);
    },
});
```

### 4. Inputs - Typed Manifest Values

Pine `input.int`, `input.string`, `input.source`, and `input.timeframe` map to
`input.int`, `input.string`, `input.source`, and `input.interval`. Declare them
in the `inputs` object and read resolved values from `ctx.inputs`.

```ts
import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Main Interval",
    apiVersion: 1,
    inputs: {
        interval: input.interval("1D", { title: "Main timeframe" }),
        source: input.source("close", { title: "Source" }),
    },
    compute({ bar, inputs }) {
        const picked = inputs.interval as string;
        plot(picked === "1D" ? bar.close : Number.NaN);
    },
});
```

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
        total.value = total.value + bar.volume;
        plot(total.value);
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
        plot(daily.close, { title: "Daily close" });
        plot(ltf.current.length, { title: "Contained 30s bars" });
    },
});
```

chartlang does not expose Pine's `lookahead` switch. The v1 semantics are the
ones specified in [Multi-stream alignment](/spec/semantics#multi-stream-alignment):
the most recent HTF value at or before the current main bar is visible, and an
in-progress HTF bar may be exposed when the host delivers one.

### 7. Signals and Markers - `ta.crossover` with `plotshape`

Pine often combines `ta.crossover` or `ta.crossunder` with `plotshape`,
`plotchar`, or `alertcondition`. chartlang keeps the cross helper and uses plot
styles for marker glyphs.

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cross Markers",
    apiVersion: 1,
    compute({ bar }) {
        const fast = ta.ema(bar.close, 9);
        const slow = ta.ema(bar.close, 21);
        const up = ta.crossover(fast, slow).current;
        plot(up ? bar.low : Number.NaN, {
            title: "Bull cross",
            style: { kind: "shape", shape: "triangle-up", size: 8, location: "below" },
            color: "#16a34a",
        });
    },
});
```

Use `style.kind: "character"` for Pine `plotchar`, and
`style.kind: "arrow"` for Pine `plotarrow`.

### 8. Visual Overrides - `bgcolor` and `barcolor`

Pine's global `bgcolor()` / `barcolor()` map to the one-call chartlang
aliases of the same name — the Pine-ergonomic form. They sugar the
`bg-color` / `bar-color` plot styles: one call instead of the verbose
`plot(NaN, { style })`. Adapters render them only when their
`Capabilities.plots` include the corresponding plot kind.

The converter emits these aliases directly, carrying the **real per-bar
color expression** — including a conditional like `close > open ?
color.green : color.red`. That dynamic color rides the wire as
`PlotEmission.colorValue` (the per-bar dynamic-color channel), so a single
`bgcolor(...)` recolors every bar by that bar's condition; the per-bar
semantics survive the conversion (no more static `plot(NaN, …)`).

```ts
import { barcolor, bgcolor, defineIndicator, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "RSI Heat",
    apiVersion: 1,
    compute({ bar }) {
        const rsi = ta.rsi(bar.close, 14).current;
        bgcolor(rsi > 70 ? "#ef4444" : "#22c55e", { transp: 85 });
        barcolor(rsi > 70 ? "#ef4444" : "#22c55e");
    },
});
```

The verbose `plot(NaN, { style })` form is the explicit equivalent — both
compile to the same emission:

```ts
plot(Number.NaN, { style: { kind: "bg-color", color: "#ef4444", transp: 85 } });
plot(Number.NaN, { style: { kind: "bar-color", color: "#ef4444" } });
```

The verbose `plot(NaN, { style })` form bakes a single **static** color into
the style. To recolor every bar by a per-bar condition, use the
`bgcolor` / `barcolor` alias (above) — the per-bar color rides the wire as
`PlotEmission.colorValue` and the converter emits the alias for exactly this
reason.

### 9. Multi-Output Indicators - Several `plot` Calls

Pine `ta.macd`, Bollinger Bands, Ichimoku, Keltner, Donchian, and volume
profile scripts commonly plot several related series. chartlang returns
structured results for those primitives and each visible series gets its own
`plot` call.

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MACD",
    apiVersion: 1,
    compute({ bar }) {
        const macd = ta.macd(bar.close);
        plot(macd.macd, { title: "MACD", color: "#2563eb" });
        plot(macd.signal, { title: "Signal", color: "#f97316" });
        plot(macd.hist, { title: "Histogram", style: { kind: "histogram" } });
    },
});
```

### 10. Sessions and Resets - `/time`

Pine session checks such as `session.ismarket` and session-anchored resets map
to the `/time` subpath plus explicit state.

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";
import { session } from "@invinite-org/chartlang-core/time";

export default defineIndicator({
    name: "Regular Session Volume",
    apiVersion: 1,
    compute({ bar, plot, state }) {
        const inRegular = session.isOpen("America/New_York", bar.time, "regular");
        const total = state.float(0);
        total.value = inRegular ? total.value + bar.volume : 0;
        plot(total.value);
    },
});
```

### 11. Fundamentals - External Data Instead of TradingView Built-ins

chartlang v1 stays data-source neutral. Pine `request.financial`,
`request.dividends`, `request.splits`, `request.earnings`, and
`request.economic` do not have host-owned built-ins. Scripts declare external
data requirements with `input.externalSeries`, and the adapter supplies values
according to its own data policy.

```ts
import { defineIndicator, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Earnings Aware",
    apiVersion: 1,
    inputs: {
        earnings: input.externalSeries({
            name: "earnings",
            schema: { kind: "external-series-schema" },
            title: "Earnings series",
        }),
    },
    compute({ bar, plot }) {
        plot(bar.close);
    },
});
```

## Pattern-Coverage Matrix

Status meanings:

- `covered` links to a worked example, spec page, or primitive page.
- `covered-inline` is a direct one-line mapping that does not need another
  example.
- `not-supported` links to the consolidated 1.0 gap entry below.

| Pine idiom | Example script(s) | chartlang equivalent | Status |
| --- | --- | --- | --- |
| `indicator(...)`, `overlay`, short names, format/precision/scale | RSI, MACD, Bollinger Bands, SuperTrend | `defineIndicator({ apiVersion: 1, ... })` and manifest overrides | covered: [mental model](#high-level-mental-model), [manifest schema](/spec/manifest#schema) |
| `input.int`, `input.float`, `input.bool`, `input.string`, `input.color` | RSI, MACD, QQE MOD, Squeeze Momentum | `input.*` descriptors in the `inputs` object | covered: [typed inputs](#_4-inputs---typed-manifest-values) |
| `input.source` and derived sources (`hl2`, `hlc3`, `ohlc4`) | CCI, MFI, VWAP, Bollinger Bands | `input.source(...)` plus `bar.hl2`, `bar.hlc3`, `bar.ohlc4`, `bar.hlcc4` | covered-inline: source fields are manifest inputs; derived sources are on `bar` |
| `input.timeframe` | MTF Trend Filter, Daily RSI Divergence | `input.interval(...)`; only one user-pickable interval per script | covered: [typed inputs](#_4-inputs---typed-manifest-values), [manifest userPickableInterval](/spec/manifest#schema) |
| Basic plots and `hline` | RSI, Stochastic, ADX, Williams %R | `plot(...)` and `hline(...)` | covered-inline: see [PlotEmission](/spec/emissions#plotemission) |
| Per-plot show/hide via `display = display.all \| display.none` | input-toggled MA / oscillator overlays (Trend Wizard) | `plot(value, { visible })`: `display = show ? display.all : display.none` → `{ visible: show }` (inverted `… ? display.none : display.all` → `{ visible: !show }`); a bare `display.none` → `{ visible: false }`; a constant `display.all` or an omitted `display=` emits **no** `visible` key (shown is the default). `visible: false` suppresses the mark (and excludes it from the y-scale) — it is NOT plotting `NaN`. Other `display.*` targets (`status_line`, `price_scale`, `pane`, `data_window`) have no analogue beyond show/hide; the converter leaves the plot visible and warns [`plot-display-approximated`](/converter/diagnostics#plot-display-approximated). | covered-inline: [PlotEmission.visible](/spec/emissions#plotemission) |
| Multi-output indicators via several `plot` calls | MACD, Bollinger Bands, Ichimoku, Keltner, Donchian | Structured `ta.*` result plus one `plot` per visible output | covered: [multi-output example](#_9-multi-output-indicators---several-plot-calls) |
| `fill()` between bands | Bollinger Bands, Keltner Channels, Ichimoku Cloud | `plot(..., { style: { kind: "filled-band", upper, lower, alpha } })` | covered-inline: [Plot kinds](/spec/emissions#plot-kinds) |
| `plotshape`, `plotchar`, `plotarrow` | SuperTrend, Pivot Points, RSI Divergence, UT Bot Alerts | `plot` styles `shape`, `character`, and `arrow` | covered: [signals and markers](#_7-signals-and-markers---ta-crossover-with-plotshape) |
| `bgcolor` and `barcolor` | Squeeze Momentum, Market Cipher-style overlays, VWAP bands | `plot` styles `bg-color` and `bar-color` | covered: [visual overrides](#_8-visual-overrides---bgcolor-and-barcolor) |
| `plotcandle` and `plotbar` overrides | Heikin Ashi overlays, candle-color scripts | `plot` styles `candle-override` and `bar-override` | covered-inline: [Plot kinds](/spec/emissions#plot-kinds) |
| `ta.crossover` and `ta.crossunder` signals | EMA Cross, RSI Cross, QQE MOD, UT Bot Alerts | `ta.crossover(...).current`, `ta.crossunder(...).current` | covered: [signals and markers](#_7-signals-and-markers---ta-crossover-with-plotshape), [`ta.crossover`](/primitives/ta/crossover) |
| `alertcondition(...)` | SMA Cross Alert, RSI Cross Alert, UT Bot Alerts | `defineAlertCondition({ conditions, compute({ signal }) })` | covered: [alerts example](#_3-alerts---rsi-cross), [AlertConditionEmission](/spec/emissions#alertconditionemission) |
| `alert(...)` | Reversal alerts, session high alerts | `alert(...)` runtime emission | covered-inline: [AlertEmission](/spec/emissions#alertemission) |
| Common TA primitives (`ta.rsi`, `ta.macd`, `ta.bb`, `ta.atr`, `ta.supertrend`) | RSI, MACD, Bollinger Bands, ATR, SuperTrend | `ta.*` namespace, warmup and NaN behavior per primitive page | covered: [TA primitive index](/primitives/ta/) |
| `ta.highest`, `ta.lowest`, `ta.barssince`, `ta.valuewhen` | Chandelier Exit, Pivot Points, RSI Divergence, UT Bot Alerts | Matching helpers in `ta.*` | covered: [`ta.barssince`](/primitives/ta/barssince), [`ta.valuewhen`](/primitives/ta/valuewhen) |
| `ta.pivothigh`, `ta.pivotlow` | Pivot Points, ZigZag, Support/Resistance, RSI Divergence | `ta.pivotsHighLow({ leftLength, rightLength })`; the converter projects the `.high` / `.low` result fields | covered: [`ta.pivotsHighLow`](/primitives/ta/pivotsHighLow) |
| Volume profile (`volume.profile_*`) | Volume Profile Visible Range, Fixed Range VP, Session VP, VPVR | `ta.visibleRangeVolumeProfile`, `ta.fixedRangeVolumeProfile`, `ta.anchoredVolumeProfile`, `ta.sessionVolumeProfile` | covered: [`ta.sessionVolumeProfile`](/primitives/ta/sessionVolumeProfile) |
| VWAP and anchored VWAP | VWAP, Session VWAP, Anchored VWAP | `ta.vwap(...)` and `ta.anchoredVwap(...)` | covered-inline: [`ta.vwap`](/primitives/ta/vwap) |
| `request.security` HTF reads | MTF Trend Filter, Daily RSI Divergence, Ichimoku MTF | `request.security({ interval })`; no Pine `lookahead` switch | covered: [MTF example](#_6-multi-timeframe---htf-and-ltf), [security alignment](#_6-multi-timeframe---htf-and-ltf) |
| `request.security_lower_tf` | Lower-TF volume/imbalance scripts | `request.lowerTf({ interval })` with contained-bar buckets | covered: [MTF example](#_6-multi-timeframe---htf-and-ltf), [semantics](/spec/semantics#multi-stream-alignment) |
| Session windows and date buckets | Session VWAP, Opening Range Breakout, Asian Session Range | `/time` helpers such as `session.isOpen`, `weekday`, and `weekKey` plus `state.*` | covered: [sessions and resets](#_10-sessions-and-resets---time) |
| `var` cross-bar state | Running highs/lows, SuperTrend direction, Chandelier trailing stops | `state.float`, `state.int`, `state.bool`, `state.string` | covered: [state example](#_5-state---pine-var) |
| `varip` tick-persistent state | Intrabar counters, realtime repaint guards | `state.tick.*` for scalar slots only | covered-inline: [state slots](/spec/semantics#callsite-id-stability-and-state-slots) |
| `line.new`, `box.new`, `label.new`, `table.new` | Pivot Points, ZigZag, Support/Resistance, dashboards | `draw.*` plus `DrawingHandle.update/remove` | covered: [drawings example](#_2-drawings---labeled-range), [drawing lifecycle](/spec/semantics#drawing-handle-lifecycle) |
| Bounded literal arrays and matrices | ZigZag, Market Structure, Volume Profile variants | Bounded literal arrays and ordinary TypeScript objects | covered-inline: literals/objects are valid where they stay in the grammar subset |
| Persistent numeric collection (a bounded `var array<float>`/`<int>` ring) | ZigZag swing buffers, rolling-window medians, event-value logs | `state.array<number>(capacity)` — a bounded FIFO ring with a compile-time literal capacity | covered: [persistent collections](#persistent-collections-and-large-arrays) |
| Persistent maps, matrices, and non-numeric collections | `map.new`, `matrix.new`, `array<bool>`/`array<string>` | `state.map` / matrices / non-numeric persistent collections are not v1 | not-supported: [persistent collections](#persistent-collections-and-large-arrays) |
| Loops over history or drawing sets | Pivot Point levels, table rows, ZigZag segments | Bounded `for` loops with literal numeric bounds; no stateful calls inside loops | covered-inline: [grammar loop rules](/spec/grammar#typescript-subset) |
| Pine libraries (`library()`, `import`) | PineCoders libraries, community utility packages | Normal bundled TypeScript helper modules only; Pine library scripts are not v1 | not-supported: [Pine library scripts](#pine-library-scripts) |
| Strategy primitives (`strategy.*`) | RSI Strategy, SuperTrend Strategy, Chandelier strategy variants | No order, fill, P&L, or equity-curve language in v1 | not-supported: [strategy primitives](#strategy-primitives) |
| TradingView-hosted fundamentals and corporate actions | Earnings overlays, dividends/splits/economic scripts | `input.externalSeries` for adapter-supplied data; Pine built-ins are absent | not-supported: [hosted fundamentals built-ins](#hosted-fundamentals-built-ins) |
| Webhook payload transport | Alert webhook bots and automation scripts | Alert emissions are adapter-facing; core does not deliver webhooks | not-supported: [webhook delivery](#webhook-delivery) |

## Not Supported in 1.0

### Strategy Primitives

Pine `strategy.entry`, `strategy.exit`, `strategy.close`, order fills, P&L
accounting, risk sizing, and equity curves are outside chartlang v1.
Strategy primitives are Beyond 1.0 and require a future
`Capabilities.strategy` flag.

### Hosted Fundamentals Built-ins

Pine `request.financial`, `request.dividends`, `request.splits`,
`request.earnings`, and `request.economic` depend on TradingView-hosted data.
chartlang stays data-source neutral. Use
`input.externalSeries(...)` when an adapter supplies equivalent data; there is
no v1 built-in data request.

### Webhook Delivery

chartlang v1 emits alert payloads to adapters. It does not specify webhook,
email, SMS, push, or broker transport. Adapters can implement downstream
delivery outside the core language contract.

### Pine Library Scripts

Pine `library()` and Pine `import` packages are not portable chartlang v1.
Scripts may use normal TypeScript helper modules that compile into the bundle,
but reusable language-level libraries are Beyond 1.0.

### Persistent Collections and Large Arrays

Bounded literal arrays and ordinary TypeScript objects are valid where they
stay within the grammar subset.

A bounded **numeric** persistent collection IS supported in v1:
[`state.array<number>(capacity)`](/primitives/state/array) is a fixed-capacity
FIFO ring you push values into across bars — the chartlang equivalent of a Pine
`var array<float>` / `var array<int>` with capacity eviction. The
serialization policy this once-deferred feature waited on is simply: **a
required compile-time literal `capacity` plus reuse of the ring buffer's
existing snapshot hooks.** Because `capacity` is a literal, the backing store is
fixed-size, the per-bar tick rollback is bounded, and the snapshot stays
JSON-clean — no new wire format. A non-literal capacity is a compile error
(`state-array-capacity-not-literal`); a capacity outside the bound is
`state-array-capacity-exceeds-max` (`MAX_STATE_ARRAY_CAPACITY` = 100 000).

Still deferred until a key/clone serialization policy is agreed:
`state.map(...)`, matrices, **non-numeric** persistent collections
(`bool` / `string` / object element types), and large mutable collections.

### Imperative Drawing Mutation Differences

Pine `line.set_xy`, `label.set_text`, `box.set_*`, and table mutation APIs map
to chartlang drawing handles where practical, but chartlang emits create,
update, and remove operations through `DrawingHandle`. Code that depends on
Pine object identity, chart-global mutable registries, or arbitrary mutation
outside `compute` must be rewritten around the handle lifecycle.

### Pine `request.security` Lookahead Switches

chartlang v1 has one HTF alignment rule and no `lookahead_on` /
`lookahead_off` option. The exact rule is frozen in
[Execution semantics](/spec/semantics#multi-stream-alignment). Scripts that
depend on Pine's historical lookahead behavior need an explicit rewrite.

### Chart-Specific UI and Screener APIs

TradingView-only UI affordances, private publication metadata, screener
columns, broker integration, and marketplace metadata are not part of the v1
language contract. Marketplace metadata is deferred beyond 1.0.

## Appendix: Audit Method and Script List

Live TradingView popularity pages were not fetched for this audit. The list is
static and intentionally reproducible: it combines the built-in indicators
most Pine authors encounter with well-known community scripts and
editor-pick-style patterns that repeatedly appear in public Pine code. The
matrix above is derived from the distinct idiom categories in this table, not
from line-by-line ports.

| script | idiom categories used |
| --- | --- |
| Relative Strength Index | inputs, plots, hline, alerts, cross helpers, NaN warmup |
| Moving Average Convergence Divergence | inputs, multi-output plots, histogram style, cross helpers |
| Bollinger Bands | inputs, multi-output plots, filled bands, source input, stdev |
| Stochastic Oscillator | inputs, multi-output plots, hline, highest/lowest helpers |
| Stochastic RSI | nested TA helpers, multi-output plots, hline |
| Ichimoku Cloud | multi-output plots, filled bands, offsets, HTF variants |
| SuperTrend | ATR, persistent direction state, markers, alerts |
| VWAP | session resets, source input, volume, multi-output bands |
| Anchored VWAP | input.time, source input, stateful anchor logic |
| Average Directional Index | multi-output plots, hline, smoothing |
| Directional Movement Index | multi-output plots, ADX helpers |
| Average True Range | inputs, plot, volatility helper |
| Parabolic SAR | marker-style plot, trend reversal state |
| On Balance Volume | cumulative state, volume, plot |
| Chaikin Money Flow | volume, source math, hline |
| Money Flow Index | source input, volume, bounded oscillator, hline |
| Commodity Channel Index | source input, hline, moving average |
| Williams Percent Range | highest/lowest, bounded oscillator, hline |
| Aroon | multi-output plots, hline, highest/lowest |
| Keltner Channels | multi-output plots, filled bands, ATR |
| Donchian Channels | highest/lowest, multi-output plots, filled bands |
| EMA Ribbon | repeated MA plots, bounded loops or explicit plots |
| SMA Ribbon | repeated MA plots, inputs, color gradients |
| Pivot Points Standard | hline levels, labels, sessions, arrays of levels |
| Pivot Points High Low | valuewhen/barssince helpers, labels, markers |
| Volume Profile Visible Range | viewport-aware profile, horizontal histogram |
| Fixed Range Volume Profile | input.time anchors, horizontal histogram |
| Session Volume Profile | session resets, volume profile, drawings |
| ZigZag | pivots, arrays, lines/labels, mutation-heavy drawing |
| Chandelier Exit | highest/lowest, ATR, cross signals, trailing state |
| Squeeze Momentum | Bollinger/Keltner stack, histogram, bgcolor |
| QQE MOD | RSI smoothing, cross helpers, markers, alerts |
| UT Bot Alerts | ATR trailing stop, cross helpers, barcolor, alerts |
| Market Cipher-style oscillator | multi-output plots, bgcolor, markers, tables |
| LuxAlgo-style Smart Money Concepts | arrays, boxes/labels/lines, sessions, tables |
| Order Block Finder | boxes, labels, arrays, persistent drawing state |
| Opening Range Breakout | session windows, state resets, boxes, alerts |
| Asian Session Range | sessions, boxes, labels, bgcolor |
| RSI Divergence | pivots, valuewhen, markers, lines, alerts |
| MACD Divergence | pivots, valuewhen, lines, alerts |
| Heikin Ashi Overlay | candle override, source transformation |
| Renko Overlay | synthetic bars, candle override, arrays |
| Volume Delta | lower-timeframe buckets, volume, histogram |
| Cumulative Volume Delta | lower-timeframe buckets, persistent state, plots |
| Anchored Volume Profile | input.time anchor, volume profile, histogram |
| Trend Lines Auto | pivots, line handles, mutation-heavy drawing |
| Support Resistance Zones | boxes, labels, arrays, alerts |
| Table Dashboard | tables, multi-symbol summary, libraries |
| Earnings Overlay | fundamentals request, labels, plot markers |
| Dividend Split Events | corporate-action request, labels, markers |
| Economic Calendar Overlay | economic request, labels, sessions |
| SuperTrend Strategy | strategy calls, SuperTrend, alerts |
| RSI Strategy | strategy calls, RSI crosses, hline |
| Chandelier Strategy | strategy calls, ATR stops, trailing state |
