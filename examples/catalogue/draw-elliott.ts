// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-17 example fragment — one runnable `default` demo per Elliott-wave
 * `draw.*` kind, family `category: "draw-elliott"`. Each entry credits exactly
 * one primitive id (the coverage signal). The barrel spreads this fragment in
 * `CATEGORY_ORDER`; see `examples/catalogue.ts`.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_ELLIOTT_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "elliott-impulse-wave",
        label: "Elliott Impulse Wave",
        description:
            "A five-wave Elliott impulse [1-2-3-4-5] drawn through five bar-anchored pivots ending at the live bar.",
        category: "draw-elliott",
        primitives: ["draw.elliottImpulseWave"],
    },
    {
        id: "elliott-correction-wave",
        label: "Elliott Correction Wave",
        description:
            "A three-wave Elliott A-B-C correction drawn through three bar-anchored pivots ending at the live bar.",
        category: "draw-elliott",
        primitives: ["draw.elliottCorrectionWave"],
    },
    {
        id: "elliott-triangle-wave",
        label: "Elliott Triangle Wave",
        description:
            "A five-wave Elliott a-b-c-d-e triangle correction whose swing amplitude contracts toward the apex.",
        category: "draw-elliott",
        primitives: ["draw.elliottTriangleWave"],
    },
    {
        id: "elliott-double-combo",
        label: "Elliott Double Combo",
        description:
            "A seven-anchor Elliott W-X-Y double-three corrective structure drawn through bar-anchored pivots.",
        category: "draw-elliott",
        primitives: ["draw.elliottDoubleCombo"],
    },
    {
        id: "elliott-triple-combo",
        label: "Elliott Triple Combo",
        description:
            "A seven-anchor Elliott W-X-Y-X-Z triple-three corrective structure drawn through bar-anchored pivots.",
        category: "draw-elliott",
        primitives: ["draw.elliottTripleCombo"],
    },
];

export default DRAW_ELLIOTT_FRAGMENT;
