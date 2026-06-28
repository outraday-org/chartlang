// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "stoch-rsi",
        label: "Stochastic RSI",
        description:
            "ta.stochRsi %K/%D in its own pane with 80/20 overbought/oversold guide levels — the Stochastic transform of the RSI series.",
        category: "ta-momentum",
        primitives: ["ta.stochRsi"],
    },
    {
        id: "stochastic-oscillator",
        label: "Stochastic Oscillator",
        description:
            "ta.stoch %K/%D(14,3,3) sourced from bar high/low/close, with 80/20 guides — the classic Stochastic Oscillator.",
        category: "ta-momentum",
        primitives: ["ta.stoch"],
    },
    {
        id: "stochastic-momentum-index",
        label: "Stochastic Momentum Index",
        description:
            "ta.smi(10,3,5) with its EMA(3) signal line and ±40 guides — Blau's double-smoothed Stochastic Momentum Index.",
        category: "ta-momentum",
        primitives: ["ta.smi"],
    },
    {
        id: "williams-r",
        label: "Williams %R",
        description:
            "ta.williamsR(14) bounded in [-100, 0] with -20/-80 overbought/oversold guide levels.",
        category: "ta-momentum",
        primitives: ["ta.williamsR"],
    },
    {
        id: "cci",
        label: "CCI",
        description:
            "ta.cci(20) over hlc3 centred on zero with the classic ±100 overbought/oversold bands.",
        category: "ta-momentum",
        primitives: ["ta.cci"],
    },
    {
        id: "chande-momentum",
        label: "Chande Momentum Oscillator",
        description: "ta.cmo(9) bounded [-100, 100] with ±50 guides and a zero centre line.",
        category: "ta-momentum",
        primitives: ["ta.cmo"],
    },
    {
        id: "momentum-oscillator",
        label: "Momentum",
        description:
            "ta.momentum(10): the raw close − close[10] difference oscillating around a zero line.",
        category: "ta-momentum",
        primitives: ["ta.momentum"],
    },
    {
        id: "rate-of-change",
        label: "Rate of Change",
        description:
            "ta.roc(12): percent change versus 12 bars ago, oscillating around a zero line.",
        category: "ta-momentum",
        primitives: ["ta.roc"],
    },
    {
        id: "true-strength-index",
        label: "True Strength Index",
        description:
            "ta.tsi(25,13) with its EMA(13) signal line around a zero centre line — Blau's double-smoothed momentum ratio.",
        category: "ta-momentum",
        primitives: ["ta.tsi"],
    },
];

export default entries;
