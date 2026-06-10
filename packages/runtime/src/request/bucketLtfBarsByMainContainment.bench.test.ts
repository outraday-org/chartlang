// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon is well under
// 1ms for this O(n+m) two-pointer walk, but wall-clock measurements in a
// fully parallel `pnpm test` run carry tens of ms of scheduler/JIT noise.
// Budget 1500ms to match the suite-wide bench-gate convention.
const THRESHOLD_MS = 1500;

function makeBars(count: number, stepMs: number): ReadonlyArray<Bar> {
    return Array.from({ length: count }, (_, i) => {
        const value = i + 1;
        return {
            time: i * stepMs,
            open: value,
            high: value,
            low: value,
            close: value,
            volume: value,
            symbol: "TEST",
            interval: "1m",
            hl2: value,
            hlc3: value,
            ohlc4: value,
            hlcc4: value,
        };
    });
}

describe("bucketLtfBarsByMainContainment threshold", () => {
    it("buckets 6 000 LTF bars into 1 500 main bars under threshold", () => {
        const main = makeBars(1_500, 60_000);
        const ltf = makeBars(6_000, 15_000);

        const start = performance.now();
        const buckets = bucketLtfBarsByMainContainment(main, ltf);
        const elapsed = performance.now() - start;

        expect(buckets).toHaveLength(main.length);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
