// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Forecast Line",
    apiVersion: 1,
    overlay: true,
    // One projected line, redrawn every bar from the same source line, so a
    // single "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, draw, plot }) {
        // A 20-bar EMA, kept as an indexable series so we can read its value
        // now (`trend[0]`) and `LOOKBACK` bars ago (`trend[LOOKBACK]`).
        const LOOKBACK = 20;
        const PROJECT = 20;
        const trend = ta.ema(bar.close, LOOKBACK);
        plot(trend, { color: "#26a69a", title: "EMA(20)" });

        // Per-bar slope of the recent trend, in price units per bar.
        const slope = (trend[0] - trend[LOOKBACK]) / LOOKBACK;

        // Project that slope `PROJECT` bars into the future. `bar.point(0, …)`
        // anchors the line's start at the current bar; `bar.point(+PROJECT, …)`
        // resolves the FORWARD offset to an extrapolated future timestamp
        // (`lastTime + PROJECT * spacing`, spacing = median retained-bar delta).
        // A positive offset is what makes the line reach to the RIGHT of the
        // last candle — the negative/zero offsets are covered by pivot-high-ray.
        if (Number.isFinite(slope)) {
            const start = bar.point(0, trend[0]);
            const end = bar.point(PROJECT, trend[0] + slope * PROJECT);
            draw.line(start, end, { color: "#ab47bc", lineWidth: 2, lineStyle: "dotted" });
        }
    },
});
