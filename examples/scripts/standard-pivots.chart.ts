// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Standard Pivots",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // ta.pivotsStandard — classic floor pivots (PP plus R1-R3 / S1-S3) derived from the prior UTC day's HLC, overlaid on price.
        const p = ta.pivotsStandard();
        plot(p.pp, { color: "#fbc02d", title: "PP" });
        plot(p.r1, { color: "#ef5350", title: "R1" });
        plot(p.r2, { color: "#ef5350", title: "R2" });
        plot(p.r3, { color: "#ef5350", title: "R3" });
        plot(p.s1, { color: "#26a69a", title: "S1" });
        plot(p.s2, { color: "#26a69a", title: "S2" });
        plot(p.s3, { color: "#26a69a", title: "S3" });
    },
});
