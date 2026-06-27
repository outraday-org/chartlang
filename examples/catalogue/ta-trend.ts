// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const TA_TREND_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "ichimoku-cloud",
        label: "Ichimoku Cloud",
        description:
            "Ichimoku via ta.ichimoku — Tenkan, Kijun, Senkou Span A/B (the cloud edges) and the lagging Chikou span, all overlaid on price.",
        category: "ta-trend",
        primitives: ["ta.ichimoku"],
    },
    {
        id: "adx-trend-strength",
        label: "ADX Trend Strength",
        description:
            "Wilder's ADX(14) in its own pane with a 25 threshold guide — readings above it mark a strengthening directional trend, regardless of side.",
        category: "ta-trend",
        primitives: ["ta.adx"],
    },
    {
        id: "dmi-directional",
        label: "DMI Directional",
        description:
            "The Directional Movement Index via ta.dmi(14): the +DI / -DI pair plus an ADX line, the classic three-line trend-direction-and-strength read.",
        category: "ta-trend",
        primitives: ["ta.dmi"],
    },
    {
        id: "aroon-up-down",
        label: "Aroon Up / Down",
        description:
            "Aroon via ta.aroon(25) — the Up and Down lines that measure how many bars ago the window last printed its high and its low.",
        category: "ta-trend",
        primitives: ["ta.aroon"],
    },
    {
        id: "aroon-oscillator",
        label: "Aroon Oscillator",
        description:
            "Aroon Oscillator via ta.aroonOsc(25) — Aroon Up minus Aroon Down as a zero-baselined histogram, positive in up-trends and negative in down-trends.",
        category: "ta-trend",
        primitives: ["ta.aroonOsc"],
    },
    {
        id: "parabolic-sar",
        label: "Parabolic SAR",
        description:
            "Parabolic SAR via ta.psar — stop-and-reverse dots that trail price and flip side once the stop is breached, rendered as circle markers over the candles.",
        category: "ta-trend",
        primitives: ["ta.psar"],
    },
    {
        id: "supertrend",
        label: "Supertrend",
        description:
            "Supertrend via ta.supertrend(10, 3) — an ATR-banded trailing line over price that flips above/below the candles as the trend direction changes.",
        category: "ta-trend",
        primitives: ["ta.supertrend"],
    },
    {
        id: "vortex-indicator",
        label: "Vortex Indicator",
        description:
            "Vortex via ta.vortex(14) — the VI+ and VI- lines; VI+ crossing above VI- signals an emerging up-trend (and the reverse a down-trend).",
        category: "ta-trend",
        primitives: ["ta.vortex"],
    },
    {
        id: "chande-kroll-stop",
        label: "Chande Kroll Stop",
        description:
            "Chande Kroll Stop via ta.chandeKrollStop — smoothed ATR-based long and short trailing stops bracketing price as overlay lines.",
        category: "ta-trend",
        primitives: ["ta.chandeKrollStop"],
    },
    {
        id: "volatility-stop",
        label: "Volatility Stop",
        description:
            "Volatility Stop via ta.volatilityStop(20, 2) — an ATR trailing stop that sits below price in up-trends and above it in down-trends.",
        category: "ta-trend",
        primitives: ["ta.volatilityStop"],
    },
    {
        id: "chandelier-exit",
        label: "Chandelier Exit",
        description:
            "Chandelier Exit via ta.chandelier(22, 3) — long and short stops hung an ATR multiple off the rolling highest high / lowest low.",
        category: "ta-trend",
        primitives: ["ta.chandelier"],
    },
];

export default TA_TREND_FRAGMENT;
