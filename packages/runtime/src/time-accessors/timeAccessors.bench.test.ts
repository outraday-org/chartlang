// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createTimeNamespace } from "./timeAccessors.js";

const FIXTURE = Date.UTC(2024, 0, 2, 13, 45, 30);

// THRESHOLD_MS — pure integer civil math is far cheaper than any TA bench.
// 100k time.year calls take ~3ms on M2; budget 200ms for CI Linux runners.
const THRESHOLD_MS = 200;

describe("time.year threshold", () => {
    it("runs 100 000 calls under threshold", () => {
        const time = createTimeNamespace(
            () => "UTC",
            () => 0,
            () => {},
        );
        const start = performance.now();
        let sink = 0;
        for (let i = 0; i < 100_000; i += 1) {
            sink += time.year(FIXTURE + i * 60_000);
        }
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
