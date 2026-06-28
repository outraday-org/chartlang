// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Close Change",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.change — the bar-over-bar first difference of close (today − yesterday), drawn as a zero-baseline histogram of momentum.
        const delta = ta.change(bar.close);
        plot(delta, {
            color: "#2962ff",
            title: "Δ Close",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
