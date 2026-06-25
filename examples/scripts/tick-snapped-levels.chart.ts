// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Headline `math.*` example: compute a support/resistance band around the
// current close and snap each edge to the symbol's tick grid with
// `math.roundToMintick(level, syminfo.mintick)` before drawing it. Unlike
// `mintick-snapped-entry.chart.ts` (which PLOTS one snapped target), this
// snaps multiple LEVELS into `draw.horizontalLine`s — the namespace's
// chart-aware rounding feeding the drawing layer.

import { defineIndicator, input, math } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Tick-Snapped Levels",
    apiVersion: 1,
    overlay: true,
    inputs: {
        bandPercent: input.float(1.5, { min: 0.1, max: 10, step: 0.1, title: "Band (%)" }),
    },
    compute({ bar, draw, inputs, syminfo }) {
        // Anchor a band around the current close, then snap each edge to the
        // tick grid so the lines land on real, tradable price levels. `math` is
        // a module-scope import (not a `compute` field); `syminfo` is the field
        // supplying the tick size.
        const fraction = (inputs.bandPercent as number) / 100;
        const resistance = math.roundToMintick(bar.close * (1 + fraction), syminfo.mintick);
        const support = math.roundToMintick(bar.close * (1 - fraction), syminfo.mintick);
        draw.horizontalLine(resistance, { color: "#ef4444", lineStyle: "dashed" });
        draw.horizontalLine(support, { color: "#22c55e", lineStyle: "dashed" });
    },
});
