// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputKind } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const FROM_TIME = 1_704_320_000_000;
const TO_TIME = 1_704_323_600_000;

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Fixed Range Volume Profile",
    apiVersion: 1,
    overlay: true,
    inputs: {
        from: input.time(${FROM_TIME}, { pickFromChart: true, title: "From" }),
        to: input.time(${TO_TIME}, { pickFromChart: true, title: "To" }),
    },
    compute({ inputs, ta, plot }) {
        const vp = ta.fixedRangeVolumeProfile({ from: inputs.from as number, to: inputs.to as number, rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "FRVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "a9f00154e27ea6047976f3c6deadeecd19694713cc705b064863b5c189c073d3",
    },
    { kind: "diagnostic-code-absent", code: "fixed-range-inverted" },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta fixed range volume profile scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO;
 */
export const TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO: Scenario = Object.freeze({
    id: "ta-fixed-range-volume-profile",
    title: "TA fixed range volume profile",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: {
        inputs: new Set<InputKind>(["interval", "time"]),
    },
    assertions: ASSERTIONS,
});
