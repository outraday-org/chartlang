// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputKind } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const ANCHOR_TIME = 1_704_320_000_000;

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Anchored Volume Profile",
    apiVersion: 1,
    overlay: true,
    inputs: {
        anchor: input.time(${ANCHOR_TIME}, { pickFromChart: true, title: "Anchor" }),
    },
    compute({ inputs, ta, plot }) {
        const vp = ta.anchoredVolumeProfile({ anchor: inputs.anchor, rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "AVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "5dd057c878d4780dfb464872b4593710d8b0154fcdba41cd2f9013950fdb6f16",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for ta anchored volume profile scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { TA_ANCHORED_VOLUME_PROFILE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ANCHORED_VOLUME_PROFILE_SCENARIO;
 */
export const TA_ANCHORED_VOLUME_PROFILE_SCENARIO: Scenario = Object.freeze({
    id: "ta-anchored-volume-profile",
    title: "TA anchored volume profile",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: {
        inputs: new Set<InputKind>(["interval", "time"]),
    },
    assertions: ASSERTIONS,
});
