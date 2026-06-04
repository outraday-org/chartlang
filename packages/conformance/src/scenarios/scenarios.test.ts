// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    BOLLINGER_BANDS_SCENARIO,
    EMA_CROSS_SCENARIO,
    PHASE_1_SCENARIOS,
    RSI_DIVERGENCE_SCENARIO,
} from "./index";

describe("Phase-1 scenario constants", () => {
    it("PHASE_1_SCENARIOS lists every scenario exactly once", () => {
        expect(PHASE_1_SCENARIOS).toEqual([
            EMA_CROSS_SCENARIO,
            BOLLINGER_BANDS_SCENARIO,
            RSI_DIVERGENCE_SCENARIO,
        ]);
        expect(Object.isFrozen(PHASE_1_SCENARIOS)).toBe(true);
    });

    it.each([
        { name: "ema-cross", scenario: EMA_CROSS_SCENARIO },
        { name: "bollinger-bands", scenario: BOLLINGER_BANDS_SCENARIO },
        { name: "rsi-divergence-alert", scenario: RSI_DIVERGENCE_SCENARIO },
    ])("$name carries a non-empty assertions array + script path", ({ scenario }) => {
        expect(scenario.id).not.toBe("");
        expect(scenario.title).not.toBe("");
        expect(scenario.scriptPath).toMatch(/^examples\/scripts\/.+\.chart\.ts$/);
        expect(scenario.intervalCount).toBe(1);
        expect(scenario.assertions.length).toBeGreaterThan(0);
        expect(Object.isFrozen(scenario)).toBe(true);
        expect(Object.isFrozen(scenario.assertions)).toBe(true);
    });

    it("every assertion declares a valid kind", () => {
        const valid = new Set([
            "plot-hash",
            "alert-count",
            "alert-message-contains",
            "diagnostic-code-absent",
            "diagnostic-code-present",
        ]);
        for (const scenario of PHASE_1_SCENARIOS) {
            for (const assertion of scenario.assertions) {
                expect(valid.has(assertion.kind)).toBe(true);
            }
        }
    });
});
