// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineDrawing } from "@invinite-org/chartlang-core";

// Idiom: the `defineDrawing` script KIND — a drawing-first script
// (docs/language/overview.md § "The four script kinds", docs/spec/grammar.md).
// It mirrors `defineIndicator` structurally but its manifest `kind` is
// `"drawing"` and its capability is `["drawings"]`; it emits via `draw.*` and
// has no `plot` output. The single line is re-emitted from the same callsite
// each bar, so one drawing handle slides with the chart.
export default defineDrawing({
    name: "Idiom · defineDrawing",
    apiVersion: 1,
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, draw }) {
        draw.line(bar.point(-20, bar.close), bar.point(0, bar.close), {
            color: "#3b82f6",
            lineWidth: 2,
        });
    },
});
