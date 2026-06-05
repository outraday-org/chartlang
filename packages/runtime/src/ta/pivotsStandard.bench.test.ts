// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pivotsStandard } from "./pivotsStandard";

// THRESHOLD_MS — pair with the Wave-5/6 S/R baseline at 300ms.
// PivotsStandard is O(1) per close (constant-time day aggregate +
// formula dispatch), so 10 000 bars runs well under threshold on
// Apple silicon.
const THRESHOLD_MS = 300;

describe("ta.pivotsStandard threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            const v = p.pp.current;
            return Number.isFinite(v) ? v : 0;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
