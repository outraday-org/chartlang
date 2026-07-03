// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Close Rising",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.rising — true only when close rose on each of the last 3 bars (every trailing first-difference strictly positive), drawn as 1-spikes on a zero baseline.
        const up = ta.rising(bar.close, 3);
        plot(up.current ? 1 : 0, {
            color: "#26a69a",
            title: "Rising(3)",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
