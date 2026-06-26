// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { array, defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Rolling Z-Score",
    apiVersion: 1,
    overlay: false,
    compute({ bar, state, plot }) {
        // Push one close per bar into a bounded FIFO window, then reduce over the
        // window with the analytic methods on the handle. A z-score is the
        // canonical "how far is now from the recent norm" — `(x − mean) / stdev`.
        const win = state.array<number>(20);
        win.push(bar.close.current);

        // Two call styles, one implementation: `win.avg()` is the method and
        // `array.stdev(win)` is the Pine-parity free-function alias that delegates
        // 1:1 to `win.stdev()` — they can never drift. Both skip NaN and return
        // NaN on an empty window, so guard the divide while the window warms.
        const mean = win.avg();
        const sd = array.stdev(win);
        plot(sd > 0 ? (bar.close.current - mean) / sd : 0, { title: "Z-Score(20)" });
    },
});
