// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

const baseTrend = defineIndicator({
    name: "base trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 10), { title: "line" });
    },
});

export default defineIndicator({
    name: "private dep consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const trend = baseTrend.output("line");
        plot(trend.current - bar.close, { title: "gap" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "f607c866545cf84ed52202ff350f16d3cbc86114c4fd1782c2f3d2ce21bc59b4",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "dep-error" },
]);

/**
 * Phase-7 indicator-composition scenario — one file, one
 * non-exported private dep + one default-export consumer. Pins the
 * consumer plot hash against the canvas2d capability bag and
 * confirms private-dep plots never reach `runner.drain().plots`.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_PRIVATE_SINGLE_FILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_PRIVATE_SINGLE_FILE_SCENARIO;
 */
export const DEP_PRIVATE_SINGLE_FILE_SCENARIO: Scenario = Object.freeze({
    id: "dep-private-single-file",
    title: "Private dep + default consumer in one file",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 50,
    assertions: ASSERTIONS,
});
