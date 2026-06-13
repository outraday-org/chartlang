// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

const fastTrend = baseTrend.withInputs({ length: 20 });
const slowSource = baseTrend.withInputs({ length: 100 });

export const slowTrend = defineIndicator({
    name: "Trend Slow",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) {
        const slow = slowSource.output("line");
        plot(slow.current, { title: "line", color: "#9ca3af" });
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
