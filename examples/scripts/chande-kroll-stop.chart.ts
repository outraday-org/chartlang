// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Chande Kroll Stop",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Smoothed ATR-based long/short trailing stops bracketing price.
        const c = ta.chandeKrollStop();
        plot(c.long, { color: "#26a69a", title: "Long Stop" });
        plot(c.short, { color: "#ef5350", title: "Short Stop" });
    },
});
