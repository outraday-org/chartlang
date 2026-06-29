// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.williamsR(14)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.williamsR(14));
    },
});
`;

// Value-pins the REAL-path Williams %R series over the bundled golden bars.
// `bar.high`/`bar.low` flow into `highest`/`lowest` AS proxies (indexable
// series sources) while `bar.close` is coerced for `williamsRValue`'s
// `Number.isFinite` guard; the proxy-coercion fix is what makes the close read
// a real number instead of an always-NaN proxy. Re-pin via the runner's
// "expected vs actual" message if the golden bars change.
const WILLIAMS_R_HASH = "9b7a4d66ba735c43b6d216f414e8d96e1b91b0021a3e5011fbac7b5f00626723";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: "<inline:ta-williams-r>.chart.ts:7:9#0", sha256: WILLIAMS_R_HASH },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.williamsR` conformance scenario. Plots a 14-bar Williams %R
 * over the bundled 10 000-bar `goldenBars.json` fixture. Y-range is
 * pinned `[-100, 0]` via `TA_REGISTRY_METADATA.williamsR.yDomain`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_WILLIAMS_R_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_WILLIAMS_R_SCENARIO;
 */
export const TA_WILLIAMS_R_SCENARIO: Scenario = Object.freeze({
    id: "ta-williams-r",
    title: "ta.williamsR(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
