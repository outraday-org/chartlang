// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, session } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cash Session Close",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, session }) {
        // `session.isOpen(time, "HHMM-HHMM", tz)` flags bars inside the regular
        // US cash session; the close is plotted only then, else NaN, so the
        // line breaks outside session. NB: this needs INTRADAY bars to
        // discriminate — on daily data the window is trivially all-open or
        // all-closed (a flat or fully-broken render), never a throw.
        const inSession = session.isOpen(bar.time, "0930-1600", "America/New_York");
        plot(inSession ? bar.close : Number.NaN, { color: "#f59e0b", title: "Session close" });
    },
});
