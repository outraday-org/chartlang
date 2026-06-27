// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Negative Volume Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // NVI only updates on bars where volume falls, tracking the "smart
        // money" price drift that happens on quiet days.
        plot(ta.nvi(), { color: "#ef5350", title: "NVI" });
    },
});
