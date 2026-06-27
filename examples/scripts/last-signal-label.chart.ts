// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Last Signal Label",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot, ta }) {
        // Persistent string slot (Pine `var string`): records the most recent
        // signal label and HOLDS it across quiet bars, only overwriting when a
        // new crossover/crossunder fires — so the label survives between events.
        const lastSignal = state.string("none");
        const ma = ta.sma(bar.close, 20);
        if (ta.crossover(bar.close, ma).current) {
            lastSignal.value = "long";
        } else if (ta.crossunder(bar.close, ma).current) {
            lastSignal.value = "short";
        }
        const encoded = lastSignal.value === "long" ? 1 : lastSignal.value === "short" ? -1 : 0;
        plot(encoded, { title: "Last signal", style: { kind: "step-line" } });
    },
});
