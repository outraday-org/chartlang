// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Draw · Fibonacci family fragment (Task 15). One single-primitive
 * `default` entry per uncovered Fibonacci `draw.*` kind, each anchored on
 * a tracked `ta.pivotsHighLow` swing leg. `draw.fibRetracement` is omitted
 * on purpose — the migrated `fib-retracement` entry in `complex.ts` already
 * owns its coverage. Spread into `EXAMPLE_CATALOGUE` by the barrel.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const drawFibonacciFragment: ReadonlyArray<ExampleMeta> = [
    {
        id: "fib-channel",
        label: "Fib Channel",
        description:
            "draw.fibChannel along a tracked swing leg: parallel fib-ratio translates of the pivot-low → pivot-high line passing through the live bar.",
        category: "draw-fibonacci",
        primitives: ["draw.fibChannel"],
    },
    {
        id: "fib-circles",
        label: "Fib Circles",
        description:
            "draw.fibCircles centred on the latest pivot low with its radius set by the latest pivot high — concentric fib-ratio circles over a tracked swing leg.",
        category: "draw-fibonacci",
        primitives: ["draw.fibCircles"],
    },
    {
        id: "fib-speed-arcs",
        label: "Fib Speed Arcs",
        description:
            "draw.fibSpeedArcs — concentric speed-resistance arcs centred on the latest pivot low, edged at the latest pivot high of a tracked swing leg.",
        category: "draw-fibonacci",
        primitives: ["draw.fibSpeedArcs"],
    },
    {
        id: "fib-speed-fan",
        label: "Fib Speed Fan",
        description:
            "draw.fibSpeedFan — a fan of fib-scaled rays from the latest pivot low toward the latest pivot high of a tracked swing leg.",
        category: "draw-fibonacci",
        primitives: ["draw.fibSpeedFan"],
    },
    {
        id: "fib-spiral",
        label: "Fib Spiral",
        description:
            "draw.fibSpiral — a golden spiral grown from the latest pivot low (centre) with its initial radius set by the latest pivot high of a tracked swing leg.",
        category: "draw-fibonacci",
        primitives: ["draw.fibSpiral"],
    },
    {
        id: "fib-time-zone",
        label: "Fib Time Zones",
        description:
            "draw.fibTimeZone — fib-spaced vertical time zones across the span between the latest pivot low and pivot high of a tracked swing leg.",
        category: "draw-fibonacci",
        primitives: ["draw.fibTimeZone"],
    },
    {
        id: "fib-trend-extension",
        label: "Fib Trend Extension",
        description:
            "draw.fibTrendExtension — the pivot-low → pivot-high price delta of a tracked swing leg projected as fib extensions from the live bar.",
        category: "draw-fibonacci",
        primitives: ["draw.fibTrendExtension"],
    },
    {
        id: "fib-trend-time",
        label: "Fib Trend Time",
        description:
            "draw.fibTrendTime — the pivot-low → pivot-high time delta of a tracked swing leg projected as fib-spaced vertical lines from the live bar.",
        category: "draw-fibonacci",
        primitives: ["draw.fibTrendTime"],
    },
    {
        id: "fib-wedge",
        label: "Fib Wedge",
        description:
            "draw.fibWedge — fib-interpolated rays fanning from the latest pivot low between its directions to the latest pivot high and the live bar.",
        category: "draw-fibonacci",
        primitives: ["draw.fibWedge"],
    },
];

export default drawFibonacciFragment;
