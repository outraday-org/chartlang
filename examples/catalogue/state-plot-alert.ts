// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const STATE_PLOT_ALERT_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "bar-counter",
        label: "Bar Counter",
        description:
            "state.int — a persistent integer slot (Pine var int) seeded once and incremented every bar, plotted as a step series so the cross-bar accumulation is visible.",
        category: "state-plot-alert",
        primitives: ["state.int"],
    },
    {
        id: "running-max-close",
        label: "Running Max Close",
        description:
            "state.float — a persistent float slot (Pine var float) holding the highest close seen so far, updated only on a new high so the line ratchets up across bars and never falls.",
        category: "state-plot-alert",
        primitives: ["state.float"],
    },
    {
        id: "cross-latch",
        label: "Cross Latch",
        description:
            "state.bool — a persistent boolean slot (Pine var bool) latched true the first time price crosses above its SMA(20) and held true thereafter, recording that the event happened at some point in history.",
        category: "state-plot-alert",
        primitives: ["state.bool"],
    },
    {
        id: "last-signal-label",
        label: "Last Signal Label",
        description:
            "state.string — a persistent string slot (Pine var string) holding the most recent long/short signal label across quiet bars, overwritten only when a new crossover or crossunder fires.",
        category: "state-plot-alert",
        primitives: ["state.string"],
    },
    {
        id: "tick-count",
        label: "Tick Count",
        description:
            "state.tick.int — a tick-persistent integer slot (Pine varip) whose writes commit immediately, even mid-bar. On the demo's confirmed-bar feed it advances once per bar; a live tick feed would commit on every intrabar tick.",
        category: "state-plot-alert",
        primitives: ["state.tick.int"],
    },
    {
        id: "tick-running-sum",
        label: "Tick Running Sum",
        description:
            "state.tick.float — a tick-persistent float slot (Pine varip) accumulating a running sum of close prices, committing the instant it is written. Confirmed-bar data folds in one close per bar; a live tick feed folds in every intrabar tick.",
        category: "state-plot-alert",
        primitives: ["state.tick.float"],
    },
    {
        id: "tick-latch",
        label: "Tick Latch",
        description:
            "state.tick.bool — a tick-persistent boolean slot (Pine varip) latched true on the first up-close and held thereafter. The demo flips it on bar close; a live tick feed would flip it the moment a tick turned up.",
        category: "state-plot-alert",
        primitives: ["state.tick.bool"],
    },
    {
        id: "tick-last-event",
        label: "Tick Last Event",
        description:
            "state.tick.string — a tick-persistent string slot (Pine varip) recording the current bar's direction as a label, committing on every write. Confirmed-bar data re-labels once per bar; a live tick feed re-labels each intrabar direction change.",
        category: "state-plot-alert",
        primitives: ["state.tick.string"],
    },
    {
        id: "plot-styled",
        label: "Styled Plot",
        description:
            "plot — a single line exercising the styling option surface: title (legend label), color, lineWidth (stroke thickness), and lineStyle (the solid/dashed/dotted dash pattern) on an EMA(20).",
        category: "state-plot-alert",
        primitives: ["plot"],
    },
    {
        id: "hline-guides",
        label: "Hline Guides",
        description:
            "hline — two fixed-price guides framing an RSI(14) oscillator: a 70 overbought line and a 30 oversold line, each pinned across all bars with its own color and dashed style.",
        category: "state-plot-alert",
        primitives: ["hline"],
    },
];

export default STATE_PLOT_ALERT_FRAGMENT;
