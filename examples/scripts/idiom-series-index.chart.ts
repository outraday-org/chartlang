// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Series Indexing",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // Idiom: reading a Series<T> by index — `.current` / `[n]` / `.length`
        // (docs/language/series-and-indexing.md § "Reading the current and prior
        // bars"). A ta.* output is itself a series, so its bar-over-bar delta is
        // just `ema.current − ema[1]`; the delta warms to a real value only once
        // two slots are filled (`ema.length >= 2`).
        const ema = ta.ema(bar.close, 14);
        const delta = ema.length >= 2 ? ema.current - ema[1] : Number.NaN;
        plot(delta, { title: "EMA(14) delta", color: "#26a69a" });
    },
});
