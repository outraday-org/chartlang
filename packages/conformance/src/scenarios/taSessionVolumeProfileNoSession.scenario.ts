// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SymInfoField } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Session Volume Profile No Session",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const vp = ta.sessionVolumeProfile({ rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "SVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "130365f4fccef0fdd20cc45d8aa1cd54d07d850d7df32dc9564539881d2a93e1",
    },
    { kind: "diagnostic-code-present", code: "session-info-missing" },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta session volume profile no session scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO;
 */
export const TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO: Scenario = Object.freeze({
    id: "ta-session-volume-profile-no-session",
    title: "TA session volume profile without session metadata",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: {
        symInfoFields: new Set<SymInfoField>(["ticker", "type", "mintick"]),
    },
    assertions: ASSERTIONS,
});
