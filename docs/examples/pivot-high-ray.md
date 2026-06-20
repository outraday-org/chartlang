# Pivot High Ray

Track the latest swing high's price and time in persistent state.* slots, then draw one horizontal ray from it that follows each new pivot via a reused draw.horizontalRay handle.

[Try it live](https://chartlang.invinite.com/?script=pivot-high-ray#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, state, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Pivot High Ray",
    apiVersion: 1,
    overlay: true,
    // One ray, reused across every bar (see below), so a single "lines"
    // slot is the whole drawing budget we need.
    maxDrawings: { lines: 1, labels: 0, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, state, draw }) {
        // Swing-high detection: a bar whose high tops the 5 bars on each
        // side. A pivot can only be *confirmed* once the 5 bars to its
        // right exist, so `pivots.high.current` turns non-NaN 5 bars late
        // and reports the high from 5 bars back.
        const pivots = ta.pivotsHighLow({ leftLength: 5, rightLength: 5 });

        // `state.*` slots persist across bars (Pine `var`). Remember the
        // latest pivot high's price AND time so we can keep drawing from
        // it on every later bar — this is the "track the last high" part.
        const lastTime = state.float(Number.NaN);
        const lastPrice = state.float(Number.NaN);

        if (!Number.isNaN(pivots.high.current)) {
            // The confirmed pivot sits 5 bars back. `bar.point(-5, …)`
            // resolves that offset to the real historical timestamp from
            // the runtime's time buffer — no hand-rolled time series. The
            // offset literal must stay in sync with `rightLength` above (a
            // negative integer literal is what sizes the lookback buffer).
            const anchor = bar.point(-5, pivots.high.current);
            lastTime.value = anchor.time;
            lastPrice.value = anchor.price;
        }

        // Once a high is known, draw a horizontal ray from it to the right
        // edge. Calling `draw.horizontalRay` every bar from this same line
        // of source reuses one drawing handle — the runtime emits an
        // `update`, not a new ray — so the single line simply jumps to each
        // new swing high as it is confirmed.
        if (!Number.isNaN(lastPrice.value)) {
            draw.horizontalRay(
                { time: lastTime.value, price: lastPrice.value },
                { color: "#ef5350", lineWidth: 2, lineStyle: "dashed" },
            );
        }
    },
});
```
