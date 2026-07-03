// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "standard-pivots",
        label: "Standard Pivots",
        description:
            "ta.pivotsStandard — classical floor pivots (PP plus R1-R3 / S1-S3) derived from the prior UTC day's high/low/close, overlaid on price.",
        category: "ta-pivots-utility",
        primitives: ["ta.pivotsStandard"],
    },
    {
        id: "williams-fractals",
        label: "Williams Fractals",
        description:
            "ta.williamsFractal — up/down fractal markers at each confirmed swing high and low (a bar whose extreme tops the symmetric window on both sides), anchored at the fractal's price.",
        category: "ta-pivots-utility",
        primitives: ["ta.williamsFractal"],
    },
    {
        id: "zigzag-swings",
        label: "ZigZag Swings",
        description:
            "ta.zigZag — a streaming swing-pivot detector whose value holds the most-recently-confirmed pivot price (a 5% reversal trailing reference level), stepped between confirmations.",
        category: "ta-pivots-utility",
        primitives: ["ta.zigZag"],
    },
    {
        id: "highest-high-channel",
        label: "Highest High Channel",
        description:
            "ta.highest — the rolling maximum high over the last 20 bars, the upper edge of a Donchian-style channel.",
        category: "ta-pivots-utility",
        primitives: ["ta.highest"],
    },
    {
        id: "lowest-low-channel",
        label: "Lowest Low Channel",
        description:
            "ta.lowest — the rolling minimum low over the last 20 bars, the lower edge of a Donchian-style channel.",
        category: "ta-pivots-utility",
        primitives: ["ta.lowest"],
    },
    {
        id: "highest-bars-offset",
        label: "Highest Bars Offset",
        description:
            "ta.highestbars — the bar offset (0 = now, -k = k bars ago) to the highest high in the trailing 20-bar window, an oscillator of how recently the high was set.",
        category: "ta-pivots-utility",
        primitives: ["ta.highestbars"],
    },
    {
        id: "lowest-bars-offset",
        label: "Lowest Bars Offset",
        description:
            "ta.lowestbars — the bar offset (0 = now, -k = k bars ago) to the lowest low in the trailing 20-bar window, an oscillator of how recently the low was set.",
        category: "ta-pivots-utility",
        primitives: ["ta.lowestbars"],
    },
    {
        id: "bars-since-overbought",
        label: "Bars Since Overbought",
        description:
            "ta.barssince — a counter that resets to 0 each time RSI(14) crosses above 70 and climbs by one every bar after, measuring how long since the last overbought breakout.",
        category: "ta-pivots-utility",
        primitives: ["ta.barssince"],
    },
    {
        id: "crossover-signal",
        label: "Crossover Signal",
        description:
            "ta.crossover — true only on the bar where the fast EMA(9) crosses above the slow EMA(21) (a golden-cross trigger), drawn as 1-spikes on a zero baseline.",
        category: "ta-pivots-utility",
        primitives: ["ta.crossover"],
    },
    {
        id: "crossunder-signal",
        label: "Crossunder Signal",
        description:
            "ta.crossunder — true only on the bar where the fast EMA(9) crosses below the slow EMA(21) (a death-cross trigger), drawn as 1-spikes on a zero baseline.",
        category: "ta-pivots-utility",
        primitives: ["ta.crossunder"],
    },
    {
        id: "value-at-cross",
        label: "Value At Cross",
        description:
            "ta.valuewhen — the close captured at the most recent SMA(10)/SMA(30) crossover, held constant between events as a stepped reference level on price.",
        category: "ta-pivots-utility",
        primitives: ["ta.valuewhen"],
    },
    {
        id: "close-change",
        label: "Close Change",
        description:
            "ta.change — the bar-over-bar first difference of close (today − yesterday), drawn as a zero-baseline histogram of momentum.",
        category: "ta-pivots-utility",
        primitives: ["ta.change"],
    },
    {
        id: "close-rising",
        label: "Close Rising",
        description:
            "ta.rising — true only when close rose on each of the last 3 bars (every trailing first-difference strictly positive), drawn as 1-spikes on a zero baseline.",
        category: "ta-pivots-utility",
        primitives: ["ta.rising"],
    },
    {
        id: "close-falling",
        label: "Close Falling",
        description:
            "ta.falling — true only when close fell on each of the last 3 bars (every trailing first-difference strictly negative), drawn as 1-spikes on a zero baseline.",
        category: "ta-pivots-utility",
        primitives: ["ta.falling"],
    },
    {
        id: "rolling-median",
        label: "Rolling Median",
        description:
            "ta.median — the rolling middle-value of the last 20 closes, a spike-robust center line where an SMA would be dragged by outliers.",
        category: "ta-pivots-utility",
        primitives: ["ta.median"],
    },
    {
        id: "nz-warmup-fill",
        label: "NZ Warmup Fill",
        description:
            "ta.nz — replace the warmup NaN of a 5-bar change with 0, so the plotted momentum line starts at the first bar instead of leaving a leading gap.",
        category: "ta-pivots-utility",
        primitives: ["ta.nz"],
    },
    {
        id: "bidirectional-cross",
        label: "Bidirectional Cross",
        description:
            "ta.cross — true on the bar where the fast EMA(9) crosses the slow EMA(21) in either direction (the union of crossover and crossunder), drawn as 1-spikes on a zero baseline.",
        category: "ta-pivots-utility",
        primitives: ["ta.cross"],
    },
    {
        id: "cumulative-volume",
        label: "Cumulative Volume",
        description:
            "ta.cum — the running (cumulative) sum of volume from the first bar, a NaN-safe total that only ever grows.",
        category: "ta-pivots-utility",
        primitives: ["ta.cum"],
    },
];

export default entries;
