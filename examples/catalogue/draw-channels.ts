// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-14 example fragment — one `default` (single-primitive) entry per
 * channel / regression / cycle `draw.*` kind, category `draw-channels`.
 * Each entry credits exactly one primitive id (the coverage signal). The
 * barrel (`examples/catalogue.ts`) spreads this array in `CATEGORY_ORDER`.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_CHANNELS_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "disjoint-channel",
        label: "Disjoint Channel",
        description:
            "draw.disjointChannel — two INDEPENDENT segments (no shared geometry): a resistance leg along the last 30 bars' highs and a separate support leg along their lows, each anchored via bar.point(-N, …).",
        category: "draw-channels",
        primitives: ["draw.disjointChannel"],
    },
    {
        id: "trend-channel",
        label: "Trend Channel",
        description:
            "draw.trendChannel — a parallel trend channel: two anchors set the primary support line over the recent lows and a third mid-window high is offset perpendicular to fix the parallel upper rail.",
        category: "draw-channels",
        primitives: ["draw.trendChannel"],
    },
    {
        id: "regression-trend",
        label: "Regression Trend",
        description:
            "draw.regressionTrend — an OLS linear-regression channel over the last 50 closes with ±2σ bands; the runtime persists the anchor pair + opts and the adapter fits the line.",
        category: "draw-channels",
        primitives: ["draw.regressionTrend"],
    },
    {
        id: "flat-top-bottom",
        label: "Flat Top / Bottom",
        description:
            "draw.flatTopBottom — two parallel HORIZONTAL rails over a 30-bar consolidation: the flat top at the window's highest high and the flat bottom at its lowest low, scanned in a bounded loop.",
        category: "draw-channels",
        primitives: ["draw.flatTopBottom"],
    },
    {
        id: "pitchfork",
        label: "Pitchfork",
        description:
            "draw.pitchfork — a standard Andrews pitchfork from three pivots (older low, mid-window high, current low): a median line from the pivot to the midpoint of the other two, with parallel rails.",
        category: "draw-channels",
        primitives: ["draw.pitchfork"],
    },
    {
        id: "pitchfan",
        label: "Pitchfan",
        description:
            "draw.pitchfan — the same three pivots as a pitchfork, but the rays DIVERGE from the single pivot through the high, the midpoint, and the low (a fan rather than parallel rails).",
        category: "draw-channels",
        primitives: ["draw.pitchfan"],
    },
    {
        id: "cyclic-lines",
        label: "Cyclic Lines",
        description:
            "draw.cyclicLines — two anchors 20 bars apart set the cycle period; the renderer tiles equally spaced vertical strokes to the right at every from.time + n*period.",
        category: "draw-channels",
        primitives: ["draw.cyclicLines"],
    },
    {
        id: "time-cycles",
        label: "Time Cycles",
        description:
            "draw.timeCycles — two anchors 30 bars apart set the cycle diameter; the renderer projects concentric upper-half arcs centred at their midpoint and tiles them across the viewport.",
        category: "draw-channels",
        primitives: ["draw.timeCycles"],
    },
];

export default DRAW_CHANNELS_FRAGMENT;
