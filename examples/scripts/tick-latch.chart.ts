// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Tick Latch",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Tick-persistent boolean slot (Pine `varip`): latches true once the
        // first up-close prints and holds it, committing the instant the write
        // happens. The demo feeds CONFIRMED bars so the latch flips on bar
        // close; on a live tick feed it would flip the moment a tick turned up.
        const wentUp = state.tick.bool(false);
        if (bar.close.current > bar.open.current) {
            wentUp.value = true;
        }
        plot(wentUp.value ? 1 : 0, { title: "Up-close seen", style: { kind: "step-line" } });
    },
});
