// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Positive Volume Index",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // PVI is the mirror of NVI: it only updates on bars where volume
        // rises, tracking the crowd's price drift on busy days.
        plot(ta.pvi(), { color: "#26a69a", title: "PVI" });
    },
});
