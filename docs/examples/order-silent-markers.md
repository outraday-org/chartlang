# Order Silent Markers

order.close — the marker opt-out: the entry passes marker: false and draws its own draw.arrowMarkUp glyph instead, while the exit keeps the auto-rendered arrow. Both orders ride the wire identically, which is the point — the orders channel is the data and the markers are a courtesy render.

[Try it live](https://chartlang.invinite.com/?script=order-silent-markers#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, draw, order, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Order Silent Markers",
    apiVersion: 1,
    overlay: true,
    // One reused arrow-mark handle, re-emitted from a fixed callsite, so a
    // single `labels` slot is the whole drawing budget this needs.
    maxDrawings: { lines: 0, labels: 1, boxes: 0, polylines: 0, other: 0 },
    compute({ bar, ta, plot, draw, order }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        const up = ta.crossover(fast, slow).current;
        const down = ta.crossunder(fast, slow).current;
        const flatOrShort = order.position().size <= 0;

        if (flatOrShort && up) {
            // `marker: false` suppresses the auto-rendered arrow AND its label.
            // The order itself is unaffected: it still rides the `orders`
            // channel and still folds into the nominal position, because
            // `marker` is render-side only and is deliberately absent from the
            // wire emission. Orders are data first; the picture is a courtesy.
            order.buy({ label: "Long", marker: false });

            // Draw the entry glyph by hand instead. An author who wants control
            // over colour, text or `z` layering takes this route — `OrderOpts`
            // has no `z`, precisely so the courtesy render never competes with
            // an author-owned drawing. Re-emitting from this one callsite reuses
            // a single handle, so the mark follows the MOST RECENT entry (the
            // same one-reused-handle idiom as `pivot-high-ray.chart.ts`).
            draw.arrowMarkUp(bar.point(0, bar.low), {
                color: "#7c3aed",
                text: "Entry",
                z: 1,
            });
        }

        // The exit leg keeps the default marker, so one script shows both
        // states: a hand-drawn entry glyph and a runtime-rendered exit arrow.
        if (!flatOrShort && down) {
            order.close({ label: "Exit" });
        }
    },
});
```
