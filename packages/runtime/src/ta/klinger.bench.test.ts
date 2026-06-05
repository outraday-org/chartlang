// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop";
import { klinger } from "./klinger";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. Klinger
// composes 3 EMA sub-slots + O(1) per-bar VF accumulator. Easily
// under 300ms at 10k bars.
const THRESHOLD_MS = 300;

describe("ta.klinger threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, (bar) => klinger("slot").klinger.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink) || Number.isNaN(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
