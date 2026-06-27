// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling Std Dev",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // Rolling sample standard deviation of the close over the last 20 bars.
        plot(ta.stdev(bar.close, 20), { color: "#2962ff", title: "StdDev(20)" });
    },
});
