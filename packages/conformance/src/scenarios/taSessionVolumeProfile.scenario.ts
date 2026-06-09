// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const SESSION_START = 1_704_067_200_000;

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Session Volume Profile",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const vp = ta.sessionVolumeProfile({ sessionStart: ${SESSION_START}, rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "SVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "6c550344a928868096df83e116f1e396e8da007966deaa1ddf3dd312900edf81",
    },
    { kind: "diagnostic-code-absent", code: "session-info-missing" },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta session volume profile scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_SESSION_VOLUME_PROFILE_SCENARIO;
 */
export const TA_SESSION_VOLUME_PROFILE_SCENARIO: Scenario = Object.freeze({
    id: "ta-session-volume-profile",
    title: "TA session volume profile",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    assertions: ASSERTIONS,
});
