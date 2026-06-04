// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "./ringBuffer";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon (M-series).
// 100k append+at(0) iterations on a 64-slot Float64RingBuffer take
// well under 5ms on M2; budget 50ms to keep slower CI runners green.
// The companion `ringBuffer.bench.ts` runs the same loop under
// `vitest bench` for the perf-tracking median.
const THRESHOLD_MS = 50;
const ITERATIONS = 100_000;
const CAPACITY = 64;

function hotLoop(): number {
    const buf = new Float64RingBuffer(CAPACITY);
    let sink = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
        buf.append(i);
        sink += buf.at(0);
    }
    return sink;
}

describe("Float64RingBuffer threshold", () => {
    it(`runs ${ITERATIONS} append+at(0) iterations under ${THRESHOLD_MS}ms`, () => {
        const start = performance.now();
        const result = hotLoop();
        const elapsed = performance.now() - start;
        expect(Number.isFinite(result)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
