// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Tick Count",
    apiVersion: 1,
    overlay: false,
    compute({ state, plot }) {
        // Tick-persistent integer slot (Pine `varip`): every write commits
        // immediately, even mid-bar. The demo feeds CONFIRMED bars, so it
        // advances once per bar here (visually identical to `state.int`); on a
        // live tick feed it would commit on every intrabar tick.
        const ticks = state.tick.int(0);
        ticks.value += 1;
        plot(ticks.value, { title: "Tick count", style: { kind: "step-line" } });
    },
});
