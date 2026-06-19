// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "SMA Offset",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const sma = ta.sma(bar.close, 20);
        plot(sma, { color: "#26a69a", title: "SMA(20)" });

        // The universal `opts.offset` is a presentation display shift, not a
        // value-read: a positive offset renders the line to the right
        // (future) and a negative offset to the left (past), while the
        // numeric series value stays unshifted (alerts and indexing see the
        // value computed at the current bar). The shift lives on the `ta`
        // call, since `plot` has no offset option.
        plot(ta.sma(bar.close, 20, { offset: 5 }), { color: "#ef5350", title: "SMA(20) +5" });
        plot(ta.sma(bar.close, 20, { offset: -5 }), { color: "#42a5f5", title: "SMA(20) −5" });
    },
});
