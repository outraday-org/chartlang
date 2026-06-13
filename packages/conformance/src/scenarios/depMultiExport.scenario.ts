// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

const fastTrend = defineIndicator({
    name: "fast trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 12), { title: "line" });
    },
});

export const slowTrend = defineIndicator({
    name: "slow trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 26), { title: "line" });
    },
});

export default defineIndicator({
    name: "multi-export consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        plot(fast.current - slow.current, { title: "spread" });
        plot(bar.close, { title: "primary close" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "470a75c74b6bc4d1426308e3b74843b6b3b224bd1dcfea6c99377def265b2614",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "dep-error" },
]);

/**
 * Phase-7 indicator-composition scenario — one file with three
 * indicators: a private dep, a named export, and a default-export
 * consumer that reads both. Pins the merged plot hash and verifies
 * private-dep plots do not surface while sibling exports do.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_MULTI_EXPORT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_MULTI_EXPORT_SCENARIO;
 */
export const DEP_MULTI_EXPORT_SCENARIO: Scenario = Object.freeze({
    id: "dep-multi-export",
    title: "Private dep + named export + default consumer in one file",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 50,
    assertions: ASSERTIONS,
});
