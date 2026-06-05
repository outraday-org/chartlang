// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { pivotsHighLow } from "./pivotsHighLow";

// THRESHOLD_MS — pair with the Wave-5/6 S/R baseline at 300ms.
// PivotsHighLow is O(leftLength + rightLength) per close (single
// centred-window scan); 10 000 bars × 9-bar window runs well under
// the threshold on Apple silicon.
const THRESHOLD_MS = 300;

describe("ta.pivotsHighLow threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => {
            const p = pivotsHighLow("slot", { leftLength: 4, rightLength: 4 });
            const v = p.high.current;
            return Number.isFinite(v) ? v : 0;
        });
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
