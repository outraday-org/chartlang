// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Plot Offset",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // Idiom: the universal `ta.*` `offset` option is a presentation-only
        // display shift, NOT a value read (docs/language/series-and-indexing.md
        // § "Shifting where a series renders"). A positive offset draws the line
        // to the right (future), a negative offset to the left (past); the
        // numeric value stays unshifted. `offset` rides the `ta` call — `plot`
        // has no offset option.
        plot(ta.sma(bar.close, 20), { title: "SMA(20)", color: "#26a69a" });
        plot(ta.sma(bar.close, 20, { offset: 5 }), { title: "SMA(20) +5", color: "#ef5350" });
        plot(ta.sma(bar.close, 20, { offset: -5 }), { title: "SMA(20) −5", color: "#42a5f5" });
    },
});
