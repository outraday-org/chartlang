// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

const fastTrend = defineIndicator({
    name: "Trend Fast",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 20), { title: "line" });
    },
});

export const slowTrend = defineIndicator({
    name: "Trend Slow",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 100), { title: "line", color: "#9ca3af" });
    },
});

export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.close, { title: "Confirmed cross", color: "#22c55e" });
        }
    },
});
