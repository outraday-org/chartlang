// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Average Daily Range",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // Average Daily Range(14): SMA of high − low across the last 14 completed UTC days.
        plot(ta.adr({ length: 14 }), { color: "#2962ff", title: "ADR(14)" });
    },
});
