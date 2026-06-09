// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { InputKind, PlotKind } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const FROM_TIME = 1_704_320_000_000;
const TO_TIME = 1_704_323_600_000;

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Fixed Range Volume Profile Gated",
    apiVersion: 1,
    overlay: true,
    inputs: {
        from: input.time(${FROM_TIME}, { pickFromChart: true, title: "From" }),
        to: input.time(${TO_TIME}, { pickFromChart: true, title: "To" }),
    },
    compute({ inputs, ta, plot }) {
        const vp = ta.fixedRangeVolumeProfile({ from: inputs.from, to: inputs.to, rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "FRVP POC", style: { kind: "horizontal-histogram", buckets: vp.buckets } });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    },
    { kind: "diagnostic-code-present", code: "unsupported-plot-kind" },
]);

const LINE_ONLY_PLOTS: ReadonlySet<PlotKind> = new Set(["line"]);

/**
 * Phase 5 conformance scenario asserting that `ta.fixedRangeVolumeProfile`
 * silently no-ops (zero plots emitted, one `unsupported-plot-kind`
 * diagnostic) when the adapter does not declare the `horizontal-histogram`
 * plot capability.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO;
 */
export const TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO: Scenario = Object.freeze({
    id: "ta-fixed-range-volume-profile-gated",
    title: "TA fixed range volume profile gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 50,
    capabilitiesOverride: {
        inputs: new Set<InputKind>(["interval", "time"]),
        plots: LINE_ONLY_PLOTS,
    },
    assertions: ASSERTIONS,
});
