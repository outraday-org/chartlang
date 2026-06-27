// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const TA_MOMENTUM_II_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "macd-histogram",
        label: "MACD",
        description:
            "ta.macd — the MACD line (fast EMA minus slow EMA) plus its signal-line EMA over a zero-based histogram of their difference, in its own pane.",
        category: "ta-momentum",
        primitives: ["ta.macd"],
    },
    {
        id: "ppo-oscillator",
        label: "Percentage Price Oscillator",
        description:
            "ta.ppo — MACD's shape normalised by the slow EMA so the line, signal, and histogram are scale-invariant across symbols.",
        category: "ta-momentum",
        primitives: ["ta.ppo"],
    },
    {
        id: "pvo-oscillator",
        label: "Percentage Volume Oscillator",
        description:
            "ta.pvo — the MACD shape applied to bar.volume and normalised by the slow EMA: line, signal, and histogram in their own pane.",
        category: "ta-momentum",
        primitives: ["ta.pvo"],
    },
    {
        id: "awesome-oscillator",
        label: "Awesome Oscillator",
        description:
            "ta.ao — Bill Williams' SMA(hl2, 5) − SMA(hl2, 34) momentum spread drawn as a zero-based histogram.",
        category: "ta-momentum",
        primitives: ["ta.ao"],
    },
    {
        id: "balance-of-power",
        label: "Balance of Power",
        description:
            "ta.bop — the per-bar (close − open) / (high − low) tug-of-war between buyers and sellers, drawn as a zero-based histogram.",
        category: "ta-momentum",
        primitives: ["ta.bop"],
    },
    {
        id: "fisher-transform",
        label: "Fisher Transform",
        description:
            "ta.fisher — John Ehlers' Fisher Transform of the rolling hl2 midpoint plus its 1-bar-lagged trigger line.",
        category: "ta-momentum",
        primitives: ["ta.fisher"],
    },
    {
        id: "connors-rsi",
        label: "Connors RSI",
        description:
            "ta.connorsRsi — Larry Connors' three-component composite (price RSI, streak RSI, ROC percent-rank) averaged into one [0, 100] line with 90/10 guides.",
        category: "ta-momentum",
        primitives: ["ta.connorsRsi"],
    },
    {
        id: "coppock-curve",
        label: "Coppock Curve",
        description:
            "ta.coppock — Edwin Coppock's long-term momentum curve (a WMA of summed rate-of-change); zero crossings are the canonical signal.",
        category: "ta-momentum",
        primitives: ["ta.coppock"],
    },
    {
        id: "know-sure-thing",
        label: "Know Sure Thing",
        description:
            "ta.kst — Martin Pring's weighted sum of four smoothed rate-of-change series plus its SMA signal line, around a zero line.",
        category: "ta-momentum",
        primitives: ["ta.kst"],
    },
    {
        id: "price-momentum-oscillator",
        label: "Price Momentum Oscillator",
        description:
            "ta.pmo — Carl Swenlin's doubly-smoothed rate-of-change momentum line plus its EMA signal line, around zero.",
        category: "ta-momentum",
        primitives: ["ta.pmo"],
    },
    {
        id: "trix-oscillator",
        label: "TRIX",
        description:
            "ta.trix — the rate-of-change of a triple-smoothed EMA (length 15) plus its EMA signal line, filtering out short-term noise.",
        category: "ta-momentum",
        primitives: ["ta.trix"],
    },
    {
        id: "relative-volatility-index",
        label: "Relative Volatility Index",
        description:
            "ta.rvi — an RSI-style oscillator that measures the direction of volatility (rolling stddev) instead of price change, bounded [0, 100].",
        category: "ta-momentum",
        primitives: ["ta.rvi"],
    },
    {
        id: "relative-vigor-index",
        label: "Relative Vigor Index",
        description:
            "ta.rvgi — John Ehlers' smoothed (close − open) / (high − low) vigor line plus its 4-bar weighted signal line, around zero.",
        category: "ta-momentum",
        primitives: ["ta.rvgi"],
    },
    {
        id: "detrended-price-oscillator",
        label: "Detrended Price Oscillator",
        description:
            "ta.dpo — removes the SMA(21) trend from price by comparing a displaced close to the moving average, isolating the short-cycle component.",
        category: "ta-momentum",
        primitives: ["ta.dpo"],
    },
    {
        id: "ultimate-oscillator",
        label: "Ultimate Oscillator",
        description:
            "ta.ultimateOsc — Larry Williams' weighted blend of buying-pressure / true-range ratios over 7/14/28 windows, bounded [0, 100] with 70/30 guides.",
        category: "ta-momentum",
        primitives: ["ta.ultimateOsc"],
    },
    {
        id: "choppiness-index",
        label: "Choppiness Index",
        description:
            "ta.chop — a [0, 100] regime gauge separating trending from sideways markets, with the 61.8 (choppy) / 38.2 (trending) Fibonacci guides.",
        category: "ta-momentum",
        primitives: ["ta.chop"],
    },
    {
        id: "trend-strength-index",
        label: "Trend Strength Index",
        description:
            "ta.trendStrengthIndex — the Pearson correlation between price and the bar index over a 20-bar window, bounded [-1, +1] around a zero line.",
        category: "ta-momentum",
        primitives: ["ta.trendStrengthIndex"],
    },
];

export default TA_MOMENTUM_II_FRAGMENT;
