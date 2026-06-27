# Anchored Line

One draw.line composing both X-axis anchor styles: an absolute-time start (the first bar's time and close, pinned in state.* slots) drawn to a bar-index end via bar.point(0, …), so the head stays fixed in time while the tail tracks the current bar.

[Try it live](https://chartlang.invinite.com/?script=anchored-line#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Anchored Line",
    apiVersion: 1,
    overlay: true,
    // One line, redrawn every bar from the same source line, so a single
    // "lines" slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, state, draw }) {
        // Pin the START anchor at an ABSOLUTE point in time: the first bar's
        // own timestamp and close, captured once into persistent `state.*`
        // slots (Pine `var`). `NaN` is the "not captured yet" sentinel, so the
        // very first bar — and only that bar — fills the slots. From then on
        // the start anchor is a fixed `{ time, price }` that never moves.
        const startTime = state.float(Number.NaN);
        const startPrice = state.float(Number.NaN);
        if (Number.isNaN(startTime.value)) {
            startTime.value = bar.time;
            // `bar.close` is a Series VIEW object, not a number — index it
            // (`[0]`) to pin the first bar's close as a finite scalar. Storing
            // the view directly would persist a live proxy whose value tracks
            // the head, and the drawing's price anchor would fail the runtime's
            // finite-WorldPoint check (dropped as a malformed emission).
            startPrice.value = bar.close[0];
        }

        // Draw a line from that absolute-time start to a BAR-INDEX end. The two
        // anchor styles compose because both resolve to a `WorldPoint`:
        //   • start — a literal `{ time, price }` built from the remembered
        //     absolute timestamp (the "start at X point in time" case).
        //   • end   — `bar.point(0, …)`, the offset-anchored current bar (the
        //     "start at X bar index" case; offset 0 == the live bar's time).
        // Re-emitting from this same source line every bar reuses one drawing
        // handle, so the line's tail tracks the latest bar while its head stays
        // pinned to the first bar's time.
        draw.line({ time: startTime.value, price: startPrice.value }, bar.point(0, bar.close), {
            color: "#3b82f6",
            lineWidth: 2,
        });
    },
});
```
