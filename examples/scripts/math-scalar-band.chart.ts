// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Comprehensive `math.*` example: a direction-aware band around each bar's
// typical price, built entirely from the pure scalar reducers — `avg` / `sum`
// (variadic skip-NaN), `clamp`, `sign`, `roundTo`, and the `nz` guard. It is
// the companion to `tick-snapped-levels.chart.ts`, which demonstrates only the
// chart-aware `roundToMintick`. `math` is a module-scope import (never a
// `compute` field); bare `Math.*` stays available alongside it.

import { defineIndicator, math, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Scalar Band",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        // The typical price is the variadic skip-NaN mean of the bar's HLC;
        // the raw band span is the (variadic, skip-NaN) high−low range.
        const typical = math.avg(bar.high, bar.low, bar.close);
        const span = math.sum(bar.high - bar.low, 0);

        // Bound the half-width so a freak bar cannot blow the band open, take
        // the candle direction as a sign, and snap the midline to cents — with
        // an `nz` guard so a non-finite rounding can never poison the plot.
        const width = math.clamp(span, 0, typical);
        const dir = math.sign(bar.close - bar.open);
        const mid = math.nz(math.roundTo(typical, 0.01), 0);

        plot(mid + dir * width, { color: "#22c55e", title: "Band edge" });
        plot(mid - dir * width, { color: "#ef4444", title: "Band edge (mirror)" });
    },
});
