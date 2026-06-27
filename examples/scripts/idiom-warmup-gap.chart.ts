// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Warmup Gap",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // Idiom: warmup NaN renders as a GAP, not a zero
        // (docs/language/series-and-indexing.md § "Warmup and NaN"). `ta.ema(_, 50)`
        // returns NaN for its first 49 bars; the plot of a NaN value is emitted as
        // `value: null` and adapters draw nothing there, so the line simply starts
        // once the average has warmed — never a misleading drop to 0.
        const ema = ta.ema(bar.close, 50);
        plot(ema, { title: "EMA(50)", color: "#ab47bc" });
    },
});
