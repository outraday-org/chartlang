// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-8 example fragment — one `default` (single-primitive) entry per
 * volume / money-flow `ta.*` primitive, all `category: "ta-volume"`. Each
 * entry credits exactly one primitive id for the coverage gate. Spread into
 * `EXAMPLE_CATALOGUE` by the `examples/catalogue.ts` barrel.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const TA_VOLUME_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "obv",
        label: "On-Balance Volume",
        description:
            "On-Balance Volume via ta.obv — a cumulative line that adds volume on up closes and subtracts it on down closes.",
        category: "ta-volume",
        primitives: ["ta.obv"],
    },
    {
        id: "vwap",
        label: "VWAP",
        description:
            "Session VWAP via ta.vwap — the volume-weighted average price overlaid on the candles.",
        category: "ta-volume",
        primitives: ["ta.vwap"],
    },
    {
        id: "anchored-vwap",
        label: "Anchored VWAP",
        description:
            "Anchored VWAP via ta.anchoredVwap — volume-weighted average price accumulated from a fixed time anchor.",
        category: "ta-volume",
        primitives: ["ta.anchoredVwap"],
    },
    {
        id: "chaikin-money-flow",
        label: "Chaikin Money Flow",
        description:
            "Chaikin Money Flow(20) via ta.cmf — money-flow volume over a window with a zero line splitting accumulation from distribution.",
        category: "ta-volume",
        primitives: ["ta.cmf"],
    },
    {
        id: "money-flow-index",
        label: "Money Flow Index",
        description:
            "Money Flow Index(14) via ta.mfi — a volume-weighted RSI bounded 0-100 with 80/20 overbought/oversold guides.",
        category: "ta-volume",
        primitives: ["ta.mfi"],
    },
    {
        id: "ease-of-movement",
        label: "Ease of Movement",
        description:
            "Ease of Movement(14) via ta.eom — price displacement relative to volume, positive when price moves on light volume.",
        category: "ta-volume",
        primitives: ["ta.eom"],
    },
    {
        id: "negative-volume-index",
        label: "Negative Volume Index",
        description:
            "Negative Volume Index via ta.nvi — a cumulative index that only updates on bars where volume falls.",
        category: "ta-volume",
        primitives: ["ta.nvi"],
    },
    {
        id: "positive-volume-index",
        label: "Positive Volume Index",
        description:
            "Positive Volume Index via ta.pvi — a cumulative index that only updates on bars where volume rises.",
        category: "ta-volume",
        primitives: ["ta.pvi"],
    },
    {
        id: "price-volume-trend",
        label: "Price Volume Trend",
        description:
            "Price Volume Trend via ta.pvt — volume scaled by each bar's percentage price change, accumulated with a zero line.",
        category: "ta-volume",
        primitives: ["ta.pvt"],
    },
    {
        id: "klinger-oscillator",
        label: "Klinger Volume Oscillator",
        description:
            "Klinger Volume Oscillator via ta.klinger — the oscillator line plus its EMA signal, with crossings flagging volume-momentum shifts.",
        category: "ta-volume",
        primitives: ["ta.klinger"],
    },
    {
        id: "chaikin-oscillator",
        label: "Chaikin Oscillator",
        description:
            "Chaikin Oscillator via ta.chaikinOsc — the difference of a fast and slow EMA of the Accumulation/Distribution line.",
        category: "ta-volume",
        primitives: ["ta.chaikinOsc"],
    },
    {
        id: "accumulation-distribution",
        label: "Accumulation/Distribution Line",
        description:
            "Accumulation/Distribution Line via ta.adl — volume weighted by the close's position within each bar's range.",
        category: "ta-volume",
        primitives: ["ta.adl"],
    },
    {
        id: "net-volume",
        label: "Net Volume",
        description:
            "Net Volume via ta.netVolume — the running up-minus-down volume drawn as a histogram off the zero baseline.",
        category: "ta-volume",
        primitives: ["ta.netVolume"],
    },
    {
        id: "raw-volume",
        label: "Volume",
        description:
            "Raw volume via ta.vol — the bar's volume plotted as a histogram off a zero baseline, the classic volume column plot.",
        category: "ta-volume",
        primitives: ["ta.vol"],
    },
];

export default TA_VOLUME_FRAGMENT;
