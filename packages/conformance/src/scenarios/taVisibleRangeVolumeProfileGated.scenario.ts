// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-adapter-kit";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "TA Visible Range Volume Profile Gated",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const warm = ta.vol()[19];
        void warm;
        const vp = ta.visibleRangeVolumeProfile({ rowSize: 24, bucketColor: "#90caf9" });
        plot(vp.poc, { title: "VRVP POC" });
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
 * Phase 5 conformance scenario asserting that `ta.visibleRangeVolumeProfile`
 * silently no-ops (zero plots emitted, one `unsupported-plot-kind`
 * diagnostic) when the adapter does not declare the `horizontal-histogram`
 * plot capability.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO;
 */
export const TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO: Scenario = Object.freeze({
    id: "ta-visible-range-volume-profile-gated",
    title: "TA visible-range volume profile gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 20,
    capabilitiesOverride: {
        plots: LINE_ONLY_PLOTS,
    },
    assertions: ASSERTIONS,
});
