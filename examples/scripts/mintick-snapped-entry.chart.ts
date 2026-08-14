// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine-parity reference: "Mintick Snapped Entry" — projects a
// target price N% above close, snapped to the symbol's mintick.
// Translated from public Pine documentation.

import { defineIndicator, input, plot, syminfo } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Mintick Snapped Entry",
    apiVersion: 1,
    overlay: true,
    inputs: {
        offsetPercent: input.float(2, { min: 0, max: 50, step: 0.1, title: "Offset (%)" }),
    },
    compute({ bar, syminfo, plot, inputs }) {
        const target = bar.close * (1 + inputs.offsetPercent / 100);
        if (!Number.isFinite(syminfo.mintick)) {
            plot(target, { color: "#10b981", title: "Target (raw)" });
            return;
        }
        const snapped = Math.round(target / syminfo.mintick) * syminfo.mintick;
        plot(snapped, { color: "#10b981", title: "Target (snapped)" });
    },
});
