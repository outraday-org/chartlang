// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Task-19 capability-gating companion. Emits one supported kind
// (`draw.line`) and one unsupported kind (`draw.rectangle`) on the
// first bar. Used against a NARROW synthetic adapter whose
// `capabilities.drawings = new Set(["line"])` — the runtime's
// `pushDrawing` (`packages/runtime/src/emit/draw/pushDrawing.ts`)
// drops the rectangle with `unsupported-drawing-kind` per §7.4 silent
// no-op semantics; the line emission survives.
//
// This scenario is exported for adapter-authors to opt in but is NOT
// added to `ALL_SCENARIOS` — the bundled conformance suite's
// `TEST_CAPABILITIES` (and the canvas2d default capability bag) both
// advertise every Phase-3 kind, which would make the
// `unsupported-drawing-kind` assertion impossible to fire. A dedicated
// `scenarios.test.ts` row drives this scenario through
// `runConformanceSuite` against a narrow inline adapter.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw-unsupported-kind",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.line(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
                { color: "#3b82f6" },
            );
            draw.rectangle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
                { stroke: "#ef4444" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "unsupported-drawing-kind" },
    {
        kind: "drawing-hash",
        sha256: "53f0d41b6063ace798e16f5e350188011bff7c45d17dd6ead4e9edc774aaf188",
    },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-19 capability-gating companion scenario. Designed to run
 * against a narrow synthetic adapter (`capabilities.drawings = new
 * Set(["line"])`) — the script emits both `draw.line` and
 * `draw.rectangle`, the line survives, the rectangle drops with the
 * `unsupported-drawing-kind` diagnostic silent no-op
 * semantics. Pinned `drawing-hash` covers the lone surviving line
 * emission.
 *
 * NOT included in `ALL_SCENARIOS` — the bundled suite's
 * `TEST_CAPABILITIES` advertises every kind, which would prevent the
 * diagnostic from firing. Adapter authors with a narrow capability
 * bag opt in by passing this scenario to `runConformanceSuite` via
 * `opts.scenarios`.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_UNSUPPORTED_KIND_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_UNSUPPORTED_KIND_SCENARIO;
 */
export const DRAW_UNSUPPORTED_KIND_SCENARIO: Scenario = Object.freeze({
    id: "draw-unsupported-kind",
    title: "Task 19 unsupported-kind (line + rectangle against {line}-only adapter)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
