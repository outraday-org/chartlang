// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Supertrend",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // ATR-banded trailing line that flips with the trend direction.
        const s = ta.supertrend({ length: 10, multiplier: 3 });
        plot(s.line, { color: "#26a69a", title: "Supertrend(10, 3)", lineWidth: 2 });
    },
});
