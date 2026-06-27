// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, hline, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Pane Routing",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, hline }) {
        // Idiom: route a mark into a named SUBPANE with `{ pane: "rsi" }`
        // (docs/spec/emissions.md#plotemission, docs/spec/semantics.md). A
        // bounded RSI(14) and its 70/30 guides share one "rsi" pane on their own
        // 0-100 scale; where the adapter has no subpane support the routed marks
        // fold back onto the overlay with an `unsupported-pane` diagnostic.
        plot(bar.close, { title: "Price" });
        plot(ta.rsi(bar.close, 14), { title: "RSI(14)", color: "#9c27b0", pane: "rsi" });
        hline(70, { title: "Overbought", color: "#ef5350", lineStyle: "dashed", pane: "rsi" });
        hline(30, { title: "Oversold", color: "#26a69a", lineStyle: "dashed", pane: "rsi" });
    },
});
