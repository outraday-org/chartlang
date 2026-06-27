// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-1 migrated example fragment — the 25 legacy `DEMO_SCRIPTS` plus the
 * 7 e2e-only on-disk `.chart.ts` files = 32 ids, classified per the Task 1
 * §6b fold rule. The **filename** is historical: a single-primitive demo
 * is a per-primitive `default` (family `category` + exactly one
 * `primitives` credit) even though it lives in this file; only the
 * genuine multi-primitive composites carry `category: "complex"`.
 * Population tasks 3–21 add their own fragments and never edit this one.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const COMPLEX_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "ema-cross",
        label: "EMA Cross",
        description:
            "A fast/slow EMA pair on the candles, firing alerts when the fast EMA crosses the slow one.",
        category: "ta-moving-averages",
        primitives: ["ta.ema"],
    },
    {
        id: "bollinger-bands",
        label: "Bollinger Bands",
        description:
            "Bollinger Bands via ta.bb — upper, middle, and lower bands plotted over price.",
        category: "ta-bands-volatility",
        primitives: ["ta.bb"],
    },
    {
        id: "rsi-divergence-alert",
        label: "RSI Divergence Alert",
        description:
            "RSI(14) in its own pane with 70/30 overbought/oversold guides and alerts on each crossing.",
        category: "ta-momentum",
        primitives: ["ta.rsi"],
    },
    {
        id: "smoothed-rsi-cross",
        label: "Smoothed RSI Cross",
        description:
            "Indicator composition: one indicator feeding another, with RSI(14) smoothed by an EMA(9) of its own output.",
        category: "complex",
        primitives: [],
    },
    {
        id: "explicit-pane-routing",
        label: "Explicit Pane Routing",
        description:
            "An EMA pair on the price pane plus an RSI oscillator routed to its own subpane via explicit pane ids.",
        category: "complex",
        primitives: [],
    },
    {
        id: "manual-sma",
        label: "Manual SMA",
        description:
            "Define an SMA by hand from the price series: a bounded for loop sums bar.close[i] over the window (the loop index is sized precisely), averages the last 5 closes, and overlays ta.sma(5).",
        category: "complex",
        primitives: [],
    },
    {
        id: "trend-composition",
        label: "Trend Composition",
        description:
            "Phase-7 indicator composition: a private dependency, a named export, and a default consumer that marks crossovers.",
        category: "complex",
        primitives: [],
    },
    {
        id: "htf-trend-filter",
        label: "HTF Trend Filter",
        description:
            'Multi-timeframe: a current-timeframe EMA(20) overlaid with a true weekly EMA(20) computed ON the weekly bars via the request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20)) expression form — a smooth, lagged trend, not 20 daily bars of a weekly-stepped series.',
        category: "complex",
        primitives: [],
    },
    {
        id: "sma-offset",
        label: "SMA Offset",
        description:
            "Three SMA(20) lines: one unshifted plus a +5 copy displaced right and a −5 copy displaced left via the universal ta offset option — a presentation-only display shift (the values stay unshifted).",
        category: "ta-moving-averages",
        primitives: ["ta.sma"],
    },
    {
        id: "pivot-high-ray",
        label: "Pivot High Ray",
        description:
            "Track the latest swing high's price and time in persistent state.* slots, then draw one horizontal ray from it that follows each new pivot via a reused draw.horizontalRay handle.",
        category: "complex",
        primitives: ["ta.pivotsHighLow", "draw.horizontalRay"],
    },
    {
        id: "forecast-line",
        label: "Forecast Line",
        description:
            "Project the recent EMA(20) slope 20 bars into the future with bar.point(+N, …), drawing a dotted line to the right of the last candle — the positive (future) offset path.",
        category: "complex",
        primitives: [],
    },
    {
        id: "fill-between-band",
        label: "Fill between series (band)",
        description:
            "A filled ribbon between two EMAs via draw.fillBetween — the native linefill / fill() equivalent.",
        category: "draw-lines",
        primitives: ["draw.fillBetween"],
    },
    {
        id: "anchored-line",
        label: "Anchored Line",
        description:
            "One draw.line composing both X-axis anchor styles: an absolute-time start (the first bar's time and close, pinned in state.* slots) drawn to a bar-index end via bar.point(0, …), so the head stays fixed in time while the tail tracks the current bar.",
        category: "draw-lines",
        primitives: ["draw.line"],
    },
    {
        id: "up-streak",
        label: "Up Streak",
        description:
            "state.series — a writable, indexable user series. Counts consecutive up-closes: the history of a value you compute yourself (here a self-referential streak defined from its own prior bar), which bar.close[N] can't express, then reads it back three bars ago.",
        category: "state-plot-alert",
        primitives: ["state.series"],
    },
    {
        id: "rolling-window-mean",
        label: "Rolling Window Mean",
        description:
            "state.array — a bounded collection you push many values into. Here a rolling mean over the last 20 closes: push one close per bar into a fixed-capacity FIFO ring, then iterate the ELEMENTS (a.get(i), 0 = newest) to average them. This is the bounded bag of the last K pushed values that state.series (one value's bar history) can't express.",
        category: "state-plot-alert",
        primitives: ["state.array"],
    },
    {
        id: "volume-by-level",
        label: "Volume by Level",
        description:
            "state.map — a persistent, bounded KEY→VALUE store. Buckets each bar's volume under its rounded close price (read-modify-write one entry per level, get() ?? 0 to seed an unseen level, oldest-inserted key evicted once 64 are tracked), then walks the entries with keyAt(i) + size (v1 has no iterators) to mark the volume point of control — the price level holding the most volume. The keyed half of the collections story that state.array (a FIFO of pushed values) can't express.",
        category: "state-plot-alert",
        primitives: ["state.array"],
    },
    {
        id: "rolling-zscore",
        label: "Rolling Z-Score",
        description:
            "state.array reductions — the analytic methods on the window handle. A z-score (close − win.avg()) / win.stdev() over the last 20 closes, showing both call styles: win.avg() (method) and array.stdev(win) (the Pine-parity free-function alias that delegates 1:1). The reductions skip NaN and return NaN on an empty window, so the divide is guarded while the window warms.",
        category: "complex",
        primitives: [],
    },
    {
        id: "symbol-ratio",
        label: "Symbol Ratio",
        description:
            "Multi-symbol request.security: read two DIFFERENT instruments (AMEX:SPY and NASDAQ:QQQ) at the chart interval and plot their close ratio. The symbol must be a compile-time literal, and a non-chart symbol needs the adapter's multiSymbol capability — otherwise the series degrade to NaN with a multi-symbol-not-supported diagnostic.",
        category: "define-bar-context",
        primitives: ["request.security"],
    },
    {
        id: "z-layering",
        label: "Z-Order Layering",
        description:
            "Use the presentation-only z option to cross render bands: a draw.fillBetween band given z: -1 renders BEHIND the price plot (a drawing beneath a plot, which the default group stack forbids), while an SMA at z: 1 sits on top.",
        category: "complex",
        primitives: [],
    },
    {
        id: "weekday-close-filter",
        label: "Weekday Close Filter",
        description:
            "Calendar accessor demo: plot the close only on weekdays (Mon–Fri via time.dayofweek), else NaN, so the line breaks across each weekend. Calendar fields come from bar.time (UTC ms epoch) through the time.* namespace — never Date/Intl. The sibling session.isOpen / input.session accessors need intraday bars to vary, so they are covered by the conformance scenarios rather than this daily-data demo.",
        category: "inputs",
        primitives: ["input.session", "time"],
    },
    {
        id: "bgcolor-barcolor",
        label: "Bg + Bar Color",
        description:
            'Pine-ergonomic color emitters: barcolor tints each candle by its own direction (blue up / orange down — deliberately not the default green/red, so the recolor is visible) and bgcolor washes the pane background by trend regime (price vs EMA(50)) with a transp transparency. Both evaluate their color expression every bar and replace the verbose plot(NaN, { style: { kind: "bar-color" | "bg-color" } }) form; adapters render them only when their plots capability includes those kinds.',
        category: "complex",
        primitives: [],
    },
    {
        id: "tick-snapped-levels",
        label: "Tick-Snapped Levels",
        description:
            "Chart-aware math.*: compute a support/resistance band around the close and snap each edge to the symbol's tick grid with math.roundToMintick(level, syminfo.mintick) before drawing it as a horizontal line. math is a module-scope import (not a compute field); syminfo supplies the tick size. Bare Math.* stays available — the namespace only adds the extras Math lacks.",
        category: "math",
        primitives: ["math"],
    },
    {
        id: "str-formatted-hud",
        label: "Formatted OHLC HUD",
        description:
            'String namespace: a draw.table HUD whose cells are built with str.*. str.tostring(value, "#.##") formats each OHLC price to a fixed-precision Pine mask (host-independent, no Intl/locale) and str.format("{0} · {1}", str.upper(bar.symbol), bar.interval) composes the header. str is a module-scope import (not a compute field); it emits no new wire primitive — the text rides the existing draw.table hole.',
        category: "str",
        primitives: ["str"],
    },
    {
        id: "math-scalar-band",
        label: "Scalar Band",
        description:
            "Comprehensive math.*: a direction-aware band around the bar's typical price built entirely from the pure scalar reducers — math.avg / math.sum (variadic skip-NaN), math.clamp to bound the half-width, math.sign for candle direction, math.roundTo to snap the midline to cents, and an math.nz guard. The companion to tick-snapped-levels (which shows only roundToMintick); math is a module-scope import and bare Math.* stays available alongside it.",
        category: "math",
        primitives: ["math"],
    },
    {
        id: "str-label-builder",
        label: "String Label Builder",
        description:
            "Comprehensive str.*: a draw.table watchlist HUD whose rows are sanitized and formatted entirely with the string namespace — str.split the comma list, str.trim each token, str.replace a leading hash, str.substring + str.upper for a 3-char code, str.startsWith / str.contains to flag, and str.repeat for a bullet divider. The companion to str-formatted-hud (which shows only tostring / format / upper); str is a module-scope import and .split(...).map(...) is plain JS array work, not a loop-restricted primitive.",
        category: "str",
        primitives: ["str"],
    },
    {
        id: "base-trend",
        label: "Base Trend",
        description:
            "Composition building block: a length-parameterized EMA indicator (input.int default 50) other scripts mount as a dependency via baseTrend.withInputs({ length }). Mounted privately it renders nothing; exported it plots its EMA line.",
        category: "complex",
        primitives: [],
    },
    {
        id: "daily-rsi-divergence",
        label: "Daily RSI Divergence",
        description:
            "Pine-parity reference: an RSI(14) that runs only on the daily timeframe (timeframe.isdaily guard) and counts bars since the last overbought/oversold extreme in a persistent state.int slot, both plotted in their own pane.",
        category: "complex",
        primitives: [],
    },
    {
        id: "mintick-snapped-entry",
        label: "Mintick Snapped Entry",
        description:
            "Pine-parity reference: projects a target price a configurable percent above the close and snaps it to the symbol's mintick grid (syminfo.mintick), falling back to the raw target when the tick size is unknown.",
        category: "complex",
        primitives: ["syminfo"],
    },
    {
        id: "session-high-alert",
        label: "Session High Alert",
        description:
            "Pine-parity reference: a running session-high tracked in a persistent state.float slot, reset on each session open, with an optional alert when the close crosses above it.",
        category: "complex",
        primitives: ["alert"],
    },
    {
        id: "trend-confirmation",
        label: "Trend Confirmation",
        description:
            "Cross-file composition: imports base-trend and mounts it twice with different lengths (withInputs({ length: 20 }) and { length: 100 }) — a fast and slow EMA — then marks the bars where the fast trend crosses above the slow one.",
        category: "complex",
        primitives: [],
    },
    {
        id: "fib-retracement",
        label: "Fib Retracement",
        description:
            "draw.fibRetracement plus draw.fibTrendExtension over one impulse leg: the retracement grid between a swing low/high (labels on, extended right) and the 1.618 trend-extension target, annotated with a draw.text caption.",
        category: "draw-fibonacci",
        primitives: ["draw.fibRetracement"],
    },
    {
        id: "persistent-color",
        label: "Persistent Color",
        description:
            "The three NON-NUMERIC persistent slots a numeric state.series can't express: state.color (a CSS color that survives across bars), state.boolSeries, and state.stringSeries (writable head plus indexable history), used to latch a position-open regime and recolor the close line by it.",
        category: "complex",
        primitives: [],
    },
];

export default COMPLEX_FRAGMENT;
