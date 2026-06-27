// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MA Ribbon",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.maRibbon computes a fan of same-kind MAs at several lengths from a
        // single call, returning one Series per length (`ma_<length>`). Plot the
        // five outputs at the default lengths (10–50) with `maType: "ema"` (the
        // ribbon's own default is "sma") to show trend strength as the spread
        // and ordering of the lines.
        const ribbon = ta.maRibbon(bar.close, {
            lengths: [10, 20, 30, 40, 50],
            maType: "ema",
        });
        plot(ribbon.ma_10, { color: "#26a69a", title: "EMA(10)" });
        plot(ribbon.ma_20, { color: "#66bb6a", title: "EMA(20)" });
        plot(ribbon.ma_30, { color: "#ffa726", title: "EMA(30)" });
        plot(ribbon.ma_40, { color: "#ef5350", title: "EMA(40)" });
        plot(ribbon.ma_50, { color: "#ab47bc", title: "EMA(50)" });
    },
});
