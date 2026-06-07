// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { kst } from "./kst";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. KST composes
// 4 SMA sub-slots + 1 signal SMA over O(1) per-bar ROCs against a
// shared source ring. Easily under 300ms at 10k bars.
const THRESHOLD_MS = 1500;

describe("ta.kst threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => kst("slot", bar.close).kst.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
