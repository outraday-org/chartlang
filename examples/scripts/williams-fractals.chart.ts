// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Williams Fractals",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // ta.williamsFractal — a marker at each confirmed swing high / low (a bar whose extreme tops the symmetric window on both sides); each output series carries the fractal's price level, NaN elsewhere.
        const f = ta.williamsFractal();
        plot(f.up, {
            color: "#26a69a",
            title: "Up Fractal",
            style: { kind: "marker", shape: "triangle-up", size: 6 },
        });
        plot(f.down, {
            color: "#ef5350",
            title: "Down Fractal",
            style: { kind: "marker", shape: "triangle-down", size: 6 },
        });
    },
});
