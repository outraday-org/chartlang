# Sine Wave Cycle

draw.sineLine — fit a sine wave over a fixed 40-bar window: baseline at the anchors' midpoint, amplitude half their price span, half-period the time between them (the window low to the window high), re-fit each bar and extended across the viewport.

[Try it live](https://chartlang.invinite.com/?script=sine-wave-cycle#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Sine Wave Cycle",
    apiVersion: 1,
    overlay: true,
    // One sine projection (draw.sineLine's bucket is `other`), reused across
    // bars.
    maxDrawings: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 1 },
    compute({ bar, ta, draw }) {
        // Fit a sine wave over a fixed 40-bar window: the baseline is the
        // midpoint of the two anchors, the amplitude half their price span, and
        // the half-period the time between them. Anchoring the `from` at the
        // window's low and the `to` at its high (40 bars apart) re-fits the one
        // reused wave to the recent range each bar; the renderer extends it
        // across the viewport.
        const SPAN = 40;
        const hi = ta.highest(bar.high, SPAN);
        const lo = ta.lowest(bar.low, SPAN);
        if (Number.isFinite(hi[0]) && Number.isFinite(lo[0])) {
            const from = bar.point(-SPAN, lo[0]);
            const to = bar.point(0, hi[0]);
            draw.sineLine(from, to, { color: "#0ea5e9", lineWidth: 2 });
        }
    },
});
```
