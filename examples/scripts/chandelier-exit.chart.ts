// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Chandelier Exit",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Long/short exits hang an ATR multiple off the highest high / lowest low.
        const c = ta.chandelier({ length: 22, multiplier: 3 });
        plot(c.long, { color: "#26a69a", title: "Long Exit" });
        plot(c.short, { color: "#ef5350", title: "Short Exit" });
    },
});
