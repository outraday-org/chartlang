// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// `defineDrawing` smoke scenario for Task 20 — exercises the
// constructor end-to-end (compiler structural-check + capability
// extraction + runtime emit) by default-exporting through
// `defineDrawing` instead of `defineIndicator`. One `draw.fibRetracement`
// emission on bar 0 keeps the scope minimal and the pinned hash
// deterministic. The compiler-side `manifest.kind === "drawing"`
// contract is covered by unit tests
// (`compile.test.ts:compiles a defineDrawing script with manifest.kind 'drawing'`,
// `defineDrawing.test.ts`, `structuralChecks.test.ts`); this scenario
// covers the post-compile emit path.
const INLINE_SOURCE = `import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({
    name: "defineDrawing basic",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibRetracement(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "eae59a6d44c41ef3b08b20728a9ee723bf0a0cd62e1107c9ab19aa4efa27b488",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `defineDrawing` constructor conformance scenario. Emits a single
 * `draw.fibRetracement(...)` on bar 0 through the Phase-3
 * `defineDrawing` script-kind. Pinned `drawing-hash` ensures the
 * post-compile runtime path is unaffected by the new constructor.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DEFINE_DRAWING_BASIC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEFINE_DRAWING_BASIC_SCENARIO;
 */
export const DEFINE_DRAWING_BASIC_SCENARIO: Scenario = Object.freeze({
    id: "define-drawing-basic",
    title: "defineDrawing — single fibRetracement emission",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
