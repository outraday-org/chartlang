// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const PRODUCER_SOURCE = `import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "cross-file producer",
    apiVersion: 1,
    overlay: true,
    inputs: { length: input.int(14, { min: 2, max: 250 }) },
    compute({ bar, ta, inputs, plot }) {
        plot(ta.ema(bar.close, inputs.length as number), { title: "line" });
    },
});
`;

const CONSUMER_SOURCE = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

// Same-file alias so the compiler's dep-accessor rewriter recognises
// the binding (cross-file imports flow through aliases per §22.10).
const trend = baseTrend.withInputs({ length: 14 });

export default defineIndicator({
    name: "cross-file consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const value = trend.output("line").current;
        plot(value - bar.close, { title: "gap" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "5a02691199ca5ac07fc48545ee75db6c43568d1517a02cafd0b562c08901155b",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "dep-error" },
]);

/**
 * Phase-7 indicator-composition scenario — consumer file imports a
 * producer file via `import baseTrend from "./base-trend.chart"` and
 * reads its `line` output. Uses {@link Scenario.additionalSources}
 * so the producer is written next to the consumer on disk before
 * compile. The compiler folds the consumer's
 * `baseTrend.withInputs({...})` alias into the inlined producer's
 * IIFE, rewrites the `.output("line")` call to the
 * `__chartlang_depOutput(...)` runtime helper, and plumbs the merged
 * effective inputs through the `__dependencies` export so the
 * runtime mounts the dep with the consumer-supplied overrides.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_CROSS_FILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_CROSS_FILE_SCENARIO;
 */
export const DEP_CROSS_FILE_SCENARIO: Scenario = Object.freeze({
    id: "dep-cross-file",
    title: "Cross-file producer import resolves through the compiler",
    inlineSource: CONSUMER_SOURCE,
    additionalSources: Object.freeze({
        "./base-trend.chart.ts": PRODUCER_SOURCE,
    }),
    intervalCount: 1,
    candleLimit: 50,
    assertions: ASSERTIONS,
});
