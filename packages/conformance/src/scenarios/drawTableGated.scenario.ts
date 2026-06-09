// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type DrawingKind, capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.table gated",
    apiVersion: 1,
    overlay: true,
    compute({ draw }) {
        draw.table({
            position: "top-right",
            cells: [[{ text: "Metric" }, { text: "Value", textHalign: "right" }]],
            borderColor: "#94a3b8",
            borderWidth: 1,
        });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    },
    { kind: "diagnostic-code-present", code: "unsupported-drawing-kind" },
]);

const PHASE_3_DRAWINGS: ReadonlySet<DrawingKind> = capabilities.allPhase3Drawings();

/**
 * Phase 5 conformance scenario for draw table gated scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { DRAW_TABLE_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TABLE_GATED_SCENARIO;
 */
export const DRAW_TABLE_GATED_SCENARIO: Scenario = Object.freeze({
    id: "draw-table-gated",
    title: "draw.table gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    capabilitiesOverride: { drawings: PHASE_3_DRAWINGS },
    assertions: ASSERTIONS,
});
