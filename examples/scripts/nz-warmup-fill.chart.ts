// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "NZ Warmup Fill",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.nz — replace the warmup NaN of a 5-bar change with 0, so the plotted momentum line starts at the very first bar instead of leaving a leading gap.
        const delta = ta.change(bar.close, { length: 5 });
        plot(ta.nz(delta.current, 0), {
            color: "#00897b",
            title: "Δ Close (nz→0)",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
