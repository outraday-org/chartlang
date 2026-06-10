// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Task-19 budget-overflow companion. Emits 150 distinct `draw.line(...)`
// callsites on the first bar — overflows the per-bucket `lines: 100`
// cap declared by the conformance suite's `TEST_CAPABILITIES` (see
// `packages/conformance/src/scenarios/scenarios.test.ts`). The
// runtime's `pushDrawing` (`packages/runtime/src/emit/draw/pushDrawing.ts`)
// drops emissions 101-150 with the `drawing-budget-exceeded` diagnostic
// after the bucket counter reaches its effective cap.
//
// The 150 callsites are unrolled at module-init time so the compiler's
// callsite-id-injection pass (PLAN.md §5.5) gives each emission a
// distinct handle id. A bounded `for`-loop would emit a single handle
// across iterations and would not exercise the per-create budget path
// at the same cardinality.
//
// Anchors are derived from `goldenBars[0].time` (1_700_000_000_000)
// + per-callsite 60_000ms offsets so each emission carries a unique
// `(time, price)` tuple — making the `drawing-hash` over the
// budget-respecting 100-line subset robust to bucket-counter ordering.
//
// NOTE: This scenario is `export`-ed but intentionally EXCLUDED from
// `ALL_SCENARIOS` because the bundled canvas2d reference adapter
// advertises `lines: 200` (per `CANVAS2D_CAPABILITIES`) — overflow
// at the 100 cap is unreachable through that adapter. Adapter
// authors with narrower caps opt in via `runConformanceSuite(adapter,
// { scenarios: [DRAW_BUDGET_OVERFLOW_SCENARIO] })`. The `TEST_CAPABILITIES`-
// driven `scenarios.test.ts` and `runConformanceSuite.test.ts` exercise
// it directly.
const LINE_COUNT = 150;
const T0 = 1_700_000_000_000;
const STEP_MS = 60_000;

function buildLineCalls(): string {
    const out: string[] = [];
    for (let i = 0; i < LINE_COUNT; i += 1) {
        const fromTime = T0 + i * STEP_MS;
        const toTime = fromTime + STEP_MS;
        const fromPrice = 100 + (i % 20);
        const toPrice = fromPrice + 5;
        out.push(
            `            draw.line({ time: ${fromTime}, price: ${fromPrice} }, ` +
                `{ time: ${toTime}, price: ${toPrice} });`,
        );
    }
    return out.join("\n");
}

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw-budget-overflow",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === ${T0}) {
${buildLineCalls()}
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "drawing-budget-exceeded" },
    {
        kind: "drawing-hash",
        sha256: "2daf386a41b8bd8da29cb48c5eb315452c4de4468c3b67c41f6f602b908f67d4",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
]);

/**
 * Task-19 budget-overflow companion scenario. Emits 150 distinct
 * `draw.line(...)` callsites on the first bar — exceeds the
 * `TEST_CAPABILITIES.maxDrawingsPerScript.lines` cap of 100 used by
 * the bundled conformance suite. Asserts `drawing-budget-exceeded` is
 * present (50 dropped emissions) and pins a `drawing-hash` over the
 * budget-respecting 100-line subset that survives.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_BUDGET_OVERFLOW_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_BUDGET_OVERFLOW_SCENARIO;
 */
export const DRAW_BUDGET_OVERFLOW_SCENARIO: Scenario = Object.freeze({
    id: "draw-budget-overflow",
    title: "Task 19 budget-overflow (150 draw.line emissions vs lines: 100 cap)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
