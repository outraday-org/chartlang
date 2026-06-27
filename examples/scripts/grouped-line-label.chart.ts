// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Grouped Line + Label",
    apiVersion: 1,
    overlay: true,
    // One line + one label, bundled under one group container, across three buckets.
    maxDrawings: { lines: 1, labels: 1, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, draw }) {
        // Emit two child kinds — a short trend line and a text label — capture their
        // handle ids, then bundle both under one draw.group so they move/select as a
        // single logical drawing (the group renders nothing of its own).
        const line = draw.line(bar.point(-10, bar.close), bar.point(0, bar.close), {
            color: "#3b82f6",
            lineWidth: 2,
        });
        const label = draw.text(bar.point(0, bar.high), "Trend", {
            color: "#1e293b",
            size: "small",
        });
        draw.group([line.id, label.id]);
    },
});
