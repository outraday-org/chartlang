// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-18 example fragment — one `default` entry per harmonic /
 * chart-pattern `draw.*` kind, category `draw-patterns`. Each credits
 * exactly one primitive so the coverage allowlist can shrink; this
 * fragment completes `draw.*` coverage.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_PATTERNS_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "abcd-pattern",
        label: "ABCD Pattern",
        description:
            "draw.abcdPattern — a 4-point ABCD measured-move zig-zag [A, B, C, D] time-anchored at fixed bar offsets via bar.point and scaled to a 1%-of-price unit.",
        category: "draw-patterns",
        primitives: ["draw.abcdPattern"],
    },
    {
        id: "cypher-pattern",
        label: "Cypher Pattern",
        description:
            "draw.cypherPattern — a 5-point Cypher harmonic pattern [X, A, B, C, D] time-anchored at fixed bar offsets via bar.point and scaled to a 1%-of-price unit.",
        category: "draw-patterns",
        primitives: ["draw.cypherPattern"],
    },
    {
        id: "xabcd-pattern",
        label: "XABCD Pattern",
        description:
            "draw.xabcdPattern — a 5-point XABCD harmonic pattern [X, A, B, C, D] time-anchored at fixed bar offsets via bar.point and scaled to a 1%-of-price unit.",
        category: "draw-patterns",
        primitives: ["draw.xabcdPattern"],
    },
    {
        id: "three-drives-pattern",
        label: "Three Drives Pattern",
        description:
            "draw.threeDrivesPattern — a 7-point three-drives reversal [start, drive1, retr1, drive2, retr2, drive3, end] as an ascending staircase time-anchored via bar.point.",
        category: "draw-patterns",
        primitives: ["draw.threeDrivesPattern"],
    },
    {
        id: "head-and-shoulders",
        label: "Head and Shoulders",
        description:
            "draw.headAndShoulders — a 5-point head-and-shoulders reversal [leftShoulder, leftLow, head, rightLow, rightShoulder] with the head topping the shoulders over a shared neckline, anchored via bar.point.",
        category: "draw-patterns",
        primitives: ["draw.headAndShoulders"],
    },
    {
        id: "triangle-pattern",
        label: "Triangle Pattern",
        description:
            "draw.trianglePattern — a 3-point triangle continuation [apex, baseHigh, baseLow] converging from a base to a current-bar apex; the LineDrawStyle outline form, distinct from the solid draw.triangle shape.",
        category: "draw-patterns",
        primitives: ["draw.trianglePattern"],
    },
];

export default DRAW_PATTERNS_FRAGMENT;
