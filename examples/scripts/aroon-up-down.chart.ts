// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Aroon Up / Down",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // Aroon Up/Down track how recently the window made its high/low.
        const a = ta.aroon(25);
        plot(a.up, { color: "#26a69a", title: "Aroon Up" });
        plot(a.down, { color: "#ef5350", title: "Aroon Down" });
    },
});
