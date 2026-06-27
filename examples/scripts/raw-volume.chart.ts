// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Volume",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // ta.vol is a pass-through of the bar's raw volume; a histogram off a
        // zero baseline is the classic volume-by-bar column plot.
        plot(ta.vol(), {
            color: "#78909c",
            title: "Volume",
            style: { kind: "histogram", baseline: 0 },
        });
    },
});
