// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-21 example fragment — one `default` (single-primitive) entry per
 * uncovered `define.*` override, the read-only context views (`barstate`,
 * `timeframe`, `session`), and `request.lowerTf`, all in the
 * `define-bar-context` category. `syminfo`, `time`, and `request.security`
 * are already covered by migrated composites and are intentionally omitted.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DEFINE_BAR_CONTEXT_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "define-format-percent",
        label: "Define · format",
        description:
            'The `format: "percent"` override: a bar-over-bar return oscillator whose axis labels and cursor read-out render with a trailing %.',
        category: "define-bar-context",
        primitives: ["define.format"],
    },
    {
        id: "define-max-bars-back",
        label: "Define · maxBarsBack",
        description:
            "The `maxBarsBack: 500` override reserving a fixed history ring (Pine `max_bars_back` parity) under a 200-period SMA.",
        category: "define-bar-context",
        primitives: ["define.maxBarsBack"],
    },
    {
        id: "define-precision",
        label: "Define · precision",
        description:
            "The `precision: 4` override forcing four decimal places on a plotted EMA, overriding the symbol's default precision.",
        category: "define-bar-context",
        primitives: ["define.precision"],
    },
    {
        id: "define-requires-intervals",
        label: "Define · requiresIntervals",
        description:
            'The `requiresIntervals: ["1D"]` override declaring the interval the adapter must ship for a daily-only trend line.',
        category: "define-bar-context",
        primitives: ["define.requiresIntervals"],
    },
    {
        id: "define-scale",
        label: "Define · scale",
        description:
            'The `scale: "right"` override binding a sub-pane oscillator to the right axis instead of the price overlay.',
        category: "define-bar-context",
        primitives: ["define.scale"],
    },
    {
        id: "define-short-name",
        label: "Define · shortName",
        description:
            'The `shortName: "EMA20"` override setting the compact legend-chip label that otherwise falls back to a truncated name.',
        category: "define-bar-context",
        primitives: ["define.shortName"],
    },
    {
        id: "barstate-confirm-alert",
        label: "Barstate Confirmed Alert",
        description:
            "Gates a crossover alert on `barstate.isconfirmed` so it fires once per closed bar instead of on every intrabar tick.",
        category: "define-bar-context",
        primitives: ["barstate"],
    },
    {
        id: "timeframe-adaptive-ma",
        label: "Timeframe-Adaptive MA",
        description:
            "Branches the moving-average length on `timeframe.isintraday` — a faster average intraday, a slower one on daily-and-up charts.",
        category: "define-bar-context",
        primitives: ["timeframe"],
    },
    {
        id: "session-window-flag",
        label: "Session Window Flag",
        description:
            "Uses `session.isOpen` to plot the close only inside the US cash session window (needs intraday bars to discriminate).",
        category: "define-bar-context",
        primitives: ["session"],
    },
    {
        id: "intrabar-lowertf",
        label: "Intrabar Bar Count",
        description:
            "Pulls the array of finer-grained bars contained in each main bar via `request.lowerTf` and plots their count.",
        category: "define-bar-context",
        primitives: ["request.lowerTf"],
    },
];

export default DEFINE_BAR_CONTEXT_FRAGMENT;
