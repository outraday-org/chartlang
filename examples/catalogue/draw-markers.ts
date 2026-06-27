// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-13 example fragment — the `draw-markers` family: one default demo per
 * marker / annotation / table `draw.*` kind. Each entry credits exactly one
 * primitive id (the coverage signal) and lives under `category: "draw-markers"`.
 * Spread into `EXAMPLE_CATALOGUE` by the barrel in `examples/catalogue.ts`.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_MARKERS_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "event-marker",
        label: "Event Marker",
        description:
            "draw.marker — a single-anchor marker glyph dropped at a detected event (price crossing up through its EMA(20)). The crossing bar is tracked in state.* slots so one reused marker handle jumps to each new event rather than stacking a glyph per bar.",
        category: "draw-markers",
        primitives: ["draw.marker"],
    },
    {
        id: "pivot-arrow-marker",
        label: "Pivot Arrow Marker",
        description:
            "draw.arrowMarker — a compact arrow-marker glyph (dot + stub + arrowhead) plus a text label, re-anchored at the latest confirmed ta.pivotsHighLow swing high. The confirmed pivot sits 5 bars back, recovered via bar.point(-5, …) and tracked in state.*.",
        category: "draw-markers",
        primitives: ["draw.arrowMarker"],
    },
    {
        id: "swing-low-buy-arrow",
        label: "Swing-Low Buy Arrow",
        description:
            "draw.arrowMarkUp — a bullish up-chevron buy signal at the latest confirmed swing LOW (ta.pivotsHighLow, the pivot recovered via bar.point(-5, …)). One reused handle, tracked in state.*, follows each new swing low.",
        category: "draw-markers",
        primitives: ["draw.arrowMarkUp"],
    },
    {
        id: "swing-high-sell-arrow",
        label: "Swing-High Sell Arrow",
        description:
            "draw.arrowMarkDown — a bearish down-chevron sell signal at the latest confirmed swing HIGH (ta.pivotsHighLow, the pivot recovered via bar.point(-5, …)). One reused handle, tracked in state.*, follows each new swing high.",
        category: "draw-markers",
        primitives: ["draw.arrowMarkDown"],
    },
    {
        id: "last-price-callout",
        label: "Last Price Callout",
        description:
            "draw.text — a freeform text annotation anchored just above the current bar via bar.point(0, …) (offset 0 == the live bar). Re-emitting from one callsite every bar reuses a single handle, so the callout tracks the last bar.",
        category: "draw-markers",
        primitives: ["draw.text"],
    },
    {
        id: "stats-table",
        label: "Stats Table",
        description:
            "draw.table — a CSS-pixel viewport-anchored HUD pinned top-right showing the last close and RSI(14). Cells are built with plain JS (Math.round + template literals, no str.*) and the table is re-emitted into one reused handle every bar so the panel updates in place.",
        category: "draw-markers",
        primitives: ["draw.table"],
    },
    {
        id: "grouped-line-label",
        label: "Grouped Line + Label",
        description:
            "draw.group — bundle two child drawings (a short draw.line trend segment and a draw.text label) under one logical container by passing their handle ids to draw.group([a.id, b.id]). The group renders nothing of its own; the children render themselves but move/select as one.",
        category: "draw-markers",
        primitives: ["draw.group"],
    },
];

export default DRAW_MARKERS_FRAGMENT;
