// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "input-int-length",
        label: "Input · Integer Length",
        description:
            "input.int(20) drives an SMA length; at the default the demo plots SMA(20) over the close.",
        category: "inputs",
        primitives: ["input.int"],
    },
    {
        id: "input-float-multiplier",
        label: "Input · Float Multiplier",
        description:
            "input.float(2.0) sets the width of a standard-deviation band around an SMA — a ±2σ envelope at the default.",
        category: "inputs",
        primitives: ["input.float"],
    },
    {
        id: "input-bool-toggle",
        label: "Input · Boolean Toggle",
        description:
            "input.bool(true) gates a plot: the EMA shows at the default and disappears (NaN) when toggled off.",
        category: "inputs",
        primitives: ["input.bool"],
    },
    {
        id: "input-string-title",
        label: "Input · String Title",
        description:
            'input.string("Trend") names the plotted line; the EMA legend reads "Trend" at the default.',
        category: "inputs",
        primitives: ["input.string"],
    },
    {
        id: "input-enum-ma-type",
        label: "Input · Enum MA Type",
        description:
            'input.enum("ema", ["ema","sma","wma"]) selects the moving-average family; the default plots an EMA(20).',
        category: "inputs",
        primitives: ["input.enum"],
    },
    {
        id: "input-color-line",
        label: "Input · Color Line",
        description:
            "input.color(\"#26a69a\") sets the plot stroke; the EMA renders teal at the default.",
        category: "inputs",
        primitives: ["input.color"],
    },
    {
        id: "input-source-select",
        label: "Input · Source Field",
        description:
            'input.source("close") picks which bar series feeds an SMA via the resolved SourceField key; SMA(close, 20) at the default.',
        category: "inputs",
        primitives: ["input.source"],
    },
    {
        id: "input-interval-timeframe",
        label: "Input · Interval Match",
        description:
            'input.interval("1D") names the tuned-for timeframe; the SMA tints teal when timeframe.period matches it, grey otherwise.',
        category: "inputs",
        primitives: ["input.interval"],
    },
    {
        id: "input-price-level",
        label: "Input · Price Level",
        description:
            "input.price(125) drives a horizontal guide level sitting inside the demo's ~100–150 close band.",
        category: "inputs",
        primitives: ["input.price"],
    },
    {
        id: "input-time-anchor",
        label: "Input · Time Anchor",
        description:
            "input.time(...) anchors a vertical guide line; the default is the demo's first-bar time, marking the series start.",
        category: "inputs",
        primitives: ["input.time"],
    },
    {
        id: "input-symbol-security",
        label: "Input · Symbol Match",
        description:
            "input.symbol(...) names the tuned-for instrument; the SMA tints teal when the chart's bar.symbol matches it, grey otherwise.",
        category: "inputs",
        primitives: ["input.symbol"],
    },
    {
        id: "input-external-series",
        label: "Input · External Series",
        description:
            "input.externalSeries(...) declares an adapter-supplied overlay; with no feed at the default the script falls back to the close.",
        category: "inputs",
        primitives: ["input.externalSeries"],
    },
];

export default entries;
