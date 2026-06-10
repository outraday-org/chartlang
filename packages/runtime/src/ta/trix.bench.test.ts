// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { trix } from "./trix.js";
import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. TRIX
// composes four EMA sub-slots per bar (three for the triple chain +
// one signal). Pair with `tema` (three EMA sub-slots) baseline at
// 300 ms.
const THRESHOLD_MS = 1500;

describe("ta.trix threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => trix("slot", bar.close, 18).trix.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
