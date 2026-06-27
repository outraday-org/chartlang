// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Stats Table",
    apiVersion: 1,
    overlay: true,
    // One viewport table, re-emitted every bar, so a single "other" slot is the budget.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, draw }) {
        // A viewport-anchored stats HUD pinned top-right: last close + RSI(14),
        // rounded with plain JS (no str.* needed) and re-emitted into one reused
        // table handle every bar so the panel updates in place.
        const rsi = ta.rsi(bar.close, 14);
        const closeText = `${Math.round(bar.close[0] * 100) / 100}`;
        const rsiText = `${Math.round(rsi.current)}`;
        draw.table({
            position: "top-right",
            cells: [
                [{ text: "Close" }, { text: closeText, textColor: "#2563eb" }],
                [{ text: "RSI(14)" }, { text: rsiText, textColor: "#16a34a" }],
            ],
        });
    },
});
