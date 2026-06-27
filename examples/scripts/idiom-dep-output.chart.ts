// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

// Private dep — a local `const` (never exported), so the host mounts it as a
// data feed and drops its own plots. Its titled `plot` defines the output a
// consumer can read.
const trendSource = defineIndicator({
    name: "Trend Source",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 50), { title: "line" });
    },
});

export default defineIndicator({
    name: "Idiom · Dependency Output",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        // Idiom: consume another indicator's titled plot as a `Series<number>`
        // via `<dep>.output("title")` (docs/language/indicator-composition.md §
        // "`.output(\"title\")` reads"). The consumer's compute runs after the
        // producer each bar; reading an untitled plot is a `dep-output-not-titled`
        // compile error.
        const trend = trendSource.output("line");
        plot(trend.current, { title: "Imported EMA(50)", color: "#3b82f6" });
    },
});
