// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const TA_BANDS_VOLATILITY_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "keltner-channel",
        label: "Keltner Channel",
        description:
            "Keltner Channel(20, 2) — an EMA(20) middle with ATR(20)-scaled upper/lower bands overlaid on price.",
        category: "ta-bands-volatility",
        primitives: ["ta.keltner"],
    },
    {
        id: "donchian-channel",
        label: "Donchian Channel",
        description:
            "Donchian Channel(20) — the highest high and lowest low over 20 bars plus their midline overlaid on price.",
        category: "ta-bands-volatility",
        primitives: ["ta.donchian"],
    },
    {
        id: "ma-envelope",
        label: "MA Envelope",
        description:
            "Moving-average envelope — an SMA(20) with bands set at ±2.5% of the average overlaid on price.",
        category: "ta-bands-volatility",
        primitives: ["ta.envelope"],
    },
    {
        id: "bollinger-bandwidth",
        label: "Bollinger Bandwidth",
        description:
            "Bollinger Bandwidth(20, 2) — the (upper − lower) / middle ratio that compresses ahead of breakouts.",
        category: "ta-bands-volatility",
        primitives: ["ta.bbw"],
    },
    {
        id: "bollinger-percent-b",
        label: "Bollinger %B",
        description:
            "Bollinger %B(20, 2) — price position within the band, with 0 (lower) and 1 (upper) guides.",
        category: "ta-bands-volatility",
        primitives: ["ta.bbPercentB"],
    },
    {
        id: "average-true-range",
        label: "Average True Range",
        description: "Wilder's Average True Range(14) — a volatility oscillator in price units.",
        category: "ta-bands-volatility",
        primitives: ["ta.atr"],
    },
    {
        id: "average-daily-range",
        label: "Average Daily Range",
        description:
            "Average Daily Range(14) — the SMA of high − low across the last 14 completed UTC calendar days.",
        category: "ta-bands-volatility",
        primitives: ["ta.adr"],
    },
    {
        id: "rolling-stdev",
        label: "Rolling Std Dev",
        description: "Rolling sample standard deviation of the close over the last 20 bars.",
        category: "ta-bands-volatility",
        primitives: ["ta.stdev"],
    },
    {
        id: "historical-volatility",
        label: "Historical Volatility",
        description:
            "Historical Volatility(10) — the annualised standard deviation of log returns, percent-scaled.",
        category: "ta-bands-volatility",
        primitives: ["ta.historicalVolatility"],
    },
    {
        id: "ulcer-index",
        label: "Ulcer Index",
        description:
            "Ulcer Index(14) — a drawdown-based downside-risk volatility oscillator that is always non-negative.",
        category: "ta-bands-volatility",
        primitives: ["ta.ulcerIndex"],
    },
    {
        id: "mass-index",
        label: "Mass Index",
        description:
            "Mass Index(9, 25) — a range EMA-of-EMA bulge oscillator with the 27 / 26.5 reversal-setup guides.",
        category: "ta-bands-volatility",
        primitives: ["ta.massIndex"],
    },
];

export default TA_BANDS_VOLATILITY_FRAGMENT;
