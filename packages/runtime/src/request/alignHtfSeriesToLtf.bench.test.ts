// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf";

const THRESHOLD_MS = 5;

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

describe("alignHtfSeriesToLtf threshold", () => {
    it("aligns 5 000 LTF bars against 1 000 HTF bars under threshold", () => {
        const htf = makeBars(1_000, 300_000);
        const htfSeries = Array.from({ length: 1_000 }, (_, i) => i + 1);
        const ltf = makeBars(5_000, 60_000);

        const start = performance.now();
        const out = alignHtfSeriesToLtf(htf, htfSeries, ltf);
        const elapsed = performance.now() - start;

        expect(out).toHaveLength(ltf.length);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
