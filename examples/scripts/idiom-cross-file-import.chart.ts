// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

// Idiom: a SAME-PACKAGE cross-file dependency — `import baseTrend from
// "./base-trend.chart"` (docs/language/indicator-composition.md § "Cross-file
// imports"). The compiler resolves the import recursively and inlines the
// producer's compiled module into this bundle (deduplicated by content hash);
// cross-PACKAGE imports are rejected at compile.
export default defineIndicator({
    name: "Idiom · Cross-File Import",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) {
        plot(baseTrend.output("line").current, { title: "Imported base trend", color: "#3b82f6" });
    },
});
