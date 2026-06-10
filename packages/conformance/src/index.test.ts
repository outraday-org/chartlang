// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    ALL_SCENARIOS,
    DRAW_BUDGET_OVERFLOW_SCENARIO,
    DRAW_UNSUPPORTED_KIND_SCENARIO,
    GOLDEN_BARS_PATH,
    generateGoldenBars,
    renderConformanceJson,
    renderConformanceMarkdown,
    runConformanceSuite,
    serialiseGoldenBars,
    writeGoldenBars,
} from "./index.js";

describe("@invinite-org/chartlang-conformance public surface", () => {
    it("exports the runner and bundled scenario array", () => {
        expect(typeof runConformanceSuite).toBe("function");
        expect(typeof renderConformanceMarkdown).toBe("function");
        expect(typeof renderConformanceJson).toBe("function");
        expect(Object.isFrozen(ALL_SCENARIOS)).toBe(true);
    });

    it("re-exports DRAW_UNSUPPORTED_KIND_SCENARIO as an opt-in (not in ALL_SCENARIOS)", () => {
        // The companion ships as a named export so adapter authors with
        // a narrow capability bag can opt in via
        // `runConformanceSuite(adapter, { scenarios: [DRAW_UNSUPPORTED_KIND_SCENARIO] })`.
        expect(DRAW_UNSUPPORTED_KIND_SCENARIO.id).toBe("draw-unsupported-kind");
        expect(ALL_SCENARIOS.includes(DRAW_UNSUPPORTED_KIND_SCENARIO)).toBe(false);
    });

    it("re-exports DRAW_BUDGET_OVERFLOW_SCENARIO as an opt-in (not in ALL_SCENARIOS)", () => {
        // The 100-cap budget-overflow companion is exported but excluded
        // from `ALL_SCENARIOS` because the canvas2d reference adapter
        // sizes `lines: 200`. Adapter authors with narrower caps opt in
        // via `runConformanceSuite(adapter, { scenarios: [DRAW_BUDGET_OVERFLOW_SCENARIO] })`.
        expect(DRAW_BUDGET_OVERFLOW_SCENARIO.id).toBe("draw-budget-overflow");
        expect(ALL_SCENARIOS.includes(DRAW_BUDGET_OVERFLOW_SCENARIO)).toBe(false);
    });

    it("exports the golden-bars fixture helpers", () => {
        expect(typeof generateGoldenBars).toBe("function");
        expect(typeof serialiseGoldenBars).toBe("function");
        expect(typeof writeGoldenBars).toBe("function");
        expect(GOLDEN_BARS_PATH).toMatch(/fixtures\/goldenBars\.json$/);
    });
});
