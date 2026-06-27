// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Hull MA Fast Turn",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        // ta.hma (Hull MA) combines WMAs to cut lag, so it turns at swing
        // points noticeably sooner than an equal-length ta.ema — plot both at
        // 16 to compare the responsiveness.
        plot(ta.hma(bar.close, 16), { color: "#26a69a", title: "HMA(16)" });
        plot(ta.ema(bar.close, 16), { color: "#ef5350", title: "EMA(16)" });
    },
});
