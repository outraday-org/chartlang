// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    BOLLINGER_BANDS_SCENARIO,
    EMA_CROSS_SCENARIO,
    GOLDEN_BARS_PATH,
    PHASE_1_SCENARIOS,
    RSI_DIVERGENCE_SCENARIO,
    generateGoldenBars,
    runConformanceSuite,
    serialiseGoldenBars,
    writeGoldenBars,
} from "./index";

describe("@invinite-org/chartlang-conformance public surface", () => {
    it("exports the runner + every Phase-1 scenario", () => {
        expect(typeof runConformanceSuite).toBe("function");
        expect(PHASE_1_SCENARIOS).toEqual([
            EMA_CROSS_SCENARIO,
            BOLLINGER_BANDS_SCENARIO,
            RSI_DIVERGENCE_SCENARIO,
        ]);
    });

    it("exports the golden-bars fixture helpers", () => {
        expect(typeof generateGoldenBars).toBe("function");
        expect(typeof serialiseGoldenBars).toBe("function");
        expect(typeof writeGoldenBars).toBe("function");
        expect(GOLDEN_BARS_PATH).toMatch(/fixtures\/goldenBars\.json$/);
    });
});
