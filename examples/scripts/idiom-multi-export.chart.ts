// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

// Idiom: one `.chart.ts` file declares THREE indicators whose export form
// decides what renders (docs/language/indicator-composition.md § "Multi-export
// files"): a private `const` dep (data feed only — its plots are dropped), an
// `export const` sibling (rendered under `export:fastTrend/`), and the
// `export default` primary. The sidecar manifest is an array when ≥2 drawn
// indicators co-exist.

// Private dep — not exported, never rendered.
const baseSource = defineIndicator({
    name: "Base Source",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 20), { title: "line" });
    },
});

// Drawn sibling — `export const` mounts + renders it.
export const fastTrend = defineIndicator({
    name: "Fast Trend",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) {
        plot(baseSource.output("line").current, { title: "EMA(20)", color: "#26a69a" });
    },
});

// Drawn primary — the default export.
export default defineIndicator({
    name: "Idiom · Multi-Export File",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 100), { title: "EMA(100)", color: "#ef5350" });
    },
});
