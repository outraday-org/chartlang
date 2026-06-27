// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Ichimoku Cloud",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        // Five Ichimoku lines on price; Senkou A/B are the cloud edges.
        const i = ta.ichimoku();
        plot(i.tenkan, { color: "#2962ff", title: "Tenkan" });
        plot(i.kijun, { color: "#b71c1c", title: "Kijun" });
        plot(i.senkouA, { color: "#26a69a", title: "Senkou A" });
        plot(i.senkouB, { color: "#ef5350", title: "Senkou B" });
        plot(i.chikou, { color: "#9c27b0", title: "Chikou" });
    },
});
