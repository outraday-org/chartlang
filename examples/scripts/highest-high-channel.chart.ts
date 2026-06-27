// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Highest High Channel",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.highest — the rolling maximum high over the last 20 bars, the upper edge of a Donchian-style channel.
        const upper = ta.highest(bar.high, 20);
        plot(upper, { color: "#ef5350", title: "Highest High(20)" });
    },
});
