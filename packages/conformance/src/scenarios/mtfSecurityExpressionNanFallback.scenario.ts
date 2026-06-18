// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "mtf security expression nan",
    apiVersion: 1,
    compute({ plot, ta, request }) {
        plot(request.security({ interval: "1D" }, (bar) => ta.ema(bar.close, 2)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "c85bd07eb710e40324234110dfddc4f7455ffacf0fea7bc1d8fca9a7f78035bc",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-present", code: "multi-timeframe-not-supported" },
]);

/**
 * `request.security` expression-form NaN fallback. A single-stream adapter
 * declares the requested interval but not multi-timeframe support, so the
 * expression series degrades to all-NaN and the runtime pushes one deduped
 * `multi-timeframe-not-supported` diagnostic (same gate as the data form's
 * {@link REQUEST_SECURITY_NAN_FALLBACK_SCENARIO}).
 *
 * @since 0.10
 * @stable
 * @example
 *     import { MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO;
 */
export const MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO: Scenario = Object.freeze({
    id: "mtf-security-expression-nan-fallback",
    title: "MTF request.security expression NaN fallback",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: Object.freeze({
        intervals: Object.freeze([{ value: "1D", label: "1 day", group: "daily" }]),
        multiTimeframe: false,
    }),
    assertions: ASSERTIONS,
});
