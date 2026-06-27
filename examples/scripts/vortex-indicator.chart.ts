// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Vortex Indicator",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // VI+ crossing above VI- signals an emerging up-trend (and vice versa).
        const v = ta.vortex(14);
        plot(v.plus, { color: "#26a69a", title: "VI+" });
        plot(v.minus, { color: "#ef5350", title: "VI-" });
    },
});
