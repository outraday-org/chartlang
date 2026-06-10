// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputKind } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const FROM_TIME = 1_704_323_600_000;
const TO_TIME = 1_704_320_000_000;

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Fixed Range Volume Profile Inverted",
    apiVersion: 1,
    overlay: true,
    inputs: {
        from: input.time(${FROM_TIME}, { pickFromChart: true, title: "From" }),
        to: input.time(${TO_TIME}, { pickFromChart: true, title: "To" }),
    },
    compute({ inputs, ta, plot }) {
        const vp = ta.fixedRangeVolumeProfile({ from: inputs.from, to: inputs.to, rowSize: 24 });
        plot(vp.poc, { title: "FRVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "fixed-range-inverted" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta fixed range volume profile inverted scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO;
 */
export const TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO: Scenario = Object.freeze({
    id: "ta-fixed-range-volume-profile-inverted",
    title: "TA fixed range volume profile inverted",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 20,
    capabilitiesOverride: {
        inputs: new Set<InputKind>(["interval", "time"]),
    },
    assertions: ASSERTIONS,
});
