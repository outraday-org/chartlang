// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Visible Range Volume Profile",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const warm = ta.vol()[99];
        void warm;
        const vp = ta.visibleRangeVolumeProfile({ rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "VRVP POC" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "f275b3ca8e3dae4b1403bde73e2a29eace3d01096f0cdec14b2dc152cd805542",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta visible range volume profile scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO;
 */
export const TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO: Scenario = Object.freeze({
    id: "ta-visible-range-volume-profile",
    title: "TA visible-range volume profile",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 20,
    assertions: ASSERTIONS,
});
