// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Highest Bars Offset",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.highestbars — the bar offset (0 = now, -k = k bars ago) to the highest high in the trailing 20-bar window, an oscillator of how recently the high was set.
        const hbar = ta.highestbars(bar.high, 20);
        plot(hbar, { color: "#ef5350", title: "Highest Bars(20)", style: { kind: "histogram" } });
    },
});
