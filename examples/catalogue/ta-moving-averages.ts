// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "wma-vs-sma",
        label: "WMA vs SMA",
        description:
            "ta.wma — a linearly-weighted moving average (newest bar heaviest) overlaid on an equal-weight SMA(20) to show how the weighting pulls the line toward price.",
        category: "ta-moving-averages",
        primitives: ["ta.wma"],
    },
    {
        id: "hma-fast-turn",
        label: "Hull MA Fast Turn",
        description:
            "ta.hma — the Hull moving average, a WMA composition that cuts lag and turns at swings sooner than an equal-length EMA(16).",
        category: "ta-moving-averages",
        primitives: ["ta.hma"],
    },
    {
        id: "dema-reduced-lag",
        label: "DEMA Reduced Lag",
        description:
            "ta.dema — the Double EMA (2·EMA − EMA(EMA)) overlaid on a plain EMA(20) to show its reduced lag on the same length.",
        category: "ta-moving-averages",
        primitives: ["ta.dema"],
    },
    {
        id: "tema-overlay",
        label: "TEMA Overlay",
        description:
            "ta.tema — the Triple EMA (3·EMA − 3·EMA(EMA) + EMA(EMA(EMA))) overlaid on a plain EMA(20), tracking price even tighter than DEMA.",
        category: "ta-moving-averages",
        primitives: ["ta.tema"],
    },
    {
        id: "smma-rma",
        label: "Smoothed MA (RMA)",
        description:
            "ta.smma — Wilder's smoothed/running MA (the α = 1/length recurrence under RSI and ATR) overlaid on a plain SMA(14).",
        category: "ta-moving-averages",
        primitives: ["ta.smma"],
    },
    {
        id: "vwma-volume-weighted",
        label: "Volume-Weighted MA",
        description:
            "ta.vwma — a volume-weighted moving average overlaid on SMA(20); heavy-volume bars pull it harder, and it reads NaN on a feed without volume.",
        category: "ta-moving-averages",
        primitives: ["ta.vwma"],
    },
    {
        id: "alma-gaussian",
        label: "ALMA Gaussian",
        description:
            "ta.alma — the Arnaud Legoux MA with Gaussian weights tuned by the offset (peak position) and sigma (spread) opts (0.85 / 6), overlaid on SMA(20).",
        category: "ta-moving-averages",
        primitives: ["ta.alma"],
    },
    {
        id: "kama-adaptive",
        label: "KAMA Adaptive",
        description:
            "ta.kama — Kaufman's Adaptive MA whose smoothing follows an efficiency ratio (length / fast / slow opts), overlaid on a fixed EMA(10).",
        category: "ta-moving-averages",
        primitives: ["ta.kama"],
    },
    {
        id: "lsma-regression",
        label: "LSMA Regression",
        description:
            "ta.lsma — the Least-Squares MA, the endpoint of the trailing-window regression line, leading price like a projected trendline vs a plain SMA(25).",
        category: "ta-moving-averages",
        primitives: ["ta.lsma"],
    },
    {
        id: "mcginley-dynamic",
        label: "McGinley Dynamic",
        description:
            "ta.mcginley — the McGinley Dynamic, a self-correcting EMA that speeds up on strong moves and smooths in quiet bars, overlaid on a plain EMA(14).",
        category: "ta-moving-averages",
        primitives: ["ta.mcginley"],
    },
    {
        id: "ma-ribbon",
        label: "MA Ribbon",
        description:
            "ta.maRibbon — a fan of same-kind MAs at several lengths from one call, here five EMA outputs ([10,20,30,40,50]) whose spread and ordering show trend strength.",
        category: "ta-moving-averages",
        primitives: ["ta.maRibbon"],
    },
];

export default entries;
