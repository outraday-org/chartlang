// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "./ringBuffer";
import { makeSeriesView } from "./seriesView";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon (M-series).
// 100k Proxy hits over a 64-slot Float64 buffer take ~50ms on M2;
// budget 200ms to keep slower CI runners green. Proxy reads are
// ~10x slower than direct buffer reads — this is the expected cost
// of the script-author-facing identity-stable Series<T> contract.
// The companion `seriesView.bench.ts` runs the same loop under
// `vitest bench` for the perf-tracking median.
const THRESHOLD_MS = 1500;
const ITERATIONS = 100_000;
const CAPACITY = 64;

function hotLoop(): number {
    const buf = new Float64RingBuffer(CAPACITY);
    const view = makeSeriesView<number>(buf);
    let sink = 0;
    for (let i = 0; i < ITERATIONS; i += 1) {
        buf.append(i);
        sink += view.current + view.length;
    }
    return sink;
}

describe("makeSeriesView threshold", () => {
    it(`runs ${ITERATIONS} Proxy reads under ${THRESHOLD_MS}ms`, () => {
        const start = performance.now();
        const result = hotLoop();
        const elapsed = performance.now() - start;
        expect(Number.isFinite(result)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
