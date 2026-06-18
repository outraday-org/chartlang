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

        // The universal `opts.offset` shifts the output forward: with
        // `{ offset: 5 }`, the returned series' `.current` reads the SMA value
        // from 5 bars ago, displacing the line to the right. The shift lives on
        // the `ta` call, since `plot` has no offset option. Past values of the
        // unshifted series remain readable by indexing, e.g. `sma[5]`.
        const smaShifted = ta.sma(bar.close, 20, { offset: 5 });
        plot(smaShifted, { color: "#ef5350", title: "SMA(20) offset 5" });
    },
});
