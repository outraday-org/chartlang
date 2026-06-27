// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-16 example fragment — one `default` entry per Gann `draw.*` kind
 * (`category: "draw-gann"`), each crediting exactly one primitive so the
 * coverage gate marks `draw.gann*` covered. Spread into `EXAMPLE_CATALOGUE`
 * by the barrel; never edited by sibling population tasks.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_GANN_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "gann-box",
        label: "Gann Box",
        description:
            "draw.gannBox over a tracked swing: the latest ta.pivotsHighLow swing low (anchored in time via bar.point(-5, …)) up to the live bar's high, so the GANN_LEVELS ratio grid spans the current swing range.",
        category: "draw-gann",
        primitives: ["draw.gannBox"],
    },
    {
        id: "gann-fan",
        label: "Gann Fan",
        description:
            "draw.gannFan from a tracked pivot: the nine canonical Gann angles fan out from the latest ta.pivotsHighLow swing low (the origin a, anchored via bar.point(-5, …)) with the 1×1 ray aimed at the live bar's high.",
        category: "draw-gann",
        primitives: ["draw.gannFan"],
    },
    {
        id: "gann-square",
        label: "Gann Square",
        description:
            "draw.gannSquare sized on a tracked swing: the latest ta.pivotsHighLow swing low and the live bar's high are the two corners, and the renderer takes max(|dx|, |dy|) as the square-of-nine side, subdivided by GANN_LEVELS.",
        category: "draw-gann",
        primitives: ["draw.gannSquare"],
    },
    {
        id: "gann-square-fixed",
        label: "Gann Square (Fixed)",
        description:
            "draw.gannSquareFixed pinned to a single tracked anchor: an 80×80px scale-locked square-of-nine on the latest ta.pivotsHighLow swing low (time recovered via bar.point(-5, …)), the single-anchor counterpart to gann-square.",
        category: "draw-gann",
        primitives: ["draw.gannSquareFixed"],
    },
];

export default DRAW_GANN_FRAGMENT;
