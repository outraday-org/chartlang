// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MA Envelope",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // Moving-average envelope: SMA(20) with bands at ±2.5% of the average.
        const e = ta.envelope(bar.close, { length: 20, percent: 2.5 });
        plot(e.upper, { color: "#cccccc", title: "Envelope Upper", lineWidth: 1 });
        plot(e.middle, { color: "#90caf9", title: "Envelope Middle", lineWidth: 2 });
        plot(e.lower, { color: "#cccccc", title: "Envelope Lower", lineWidth: 1 });
    },
});
