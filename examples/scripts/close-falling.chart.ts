// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Close Falling",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.falling — true only when close fell on each of the last 3 bars (every trailing first-difference strictly negative), drawn as 1-spikes on a zero baseline.
        const down = ta.falling(bar.close, 3);
        plot(down.current ? 1 : 0, {
            color: "#ef5350",
            title: "Falling(3)",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
