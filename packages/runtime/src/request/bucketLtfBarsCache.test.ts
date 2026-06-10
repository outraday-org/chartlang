// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { getOrBucket } from "./bucketLtfBarsCache.js";

const bar = (time: number): Bar => ({
    time,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    volume: 1,
    symbol: "S",
    interval: "x",
    hl2: 1,
    hlc3: 1,
    ohlc4: 1,
    hlcc4: 1,
});

describe("getOrBucket", () => {
    it("returns the same reference for the same identities", () => {
        const main = [bar(0), bar(60)];
        const ltf = [bar(0), bar(30)];
        expect(getOrBucket(main, ltf)).toBe(getOrBucket(main, ltf));
    });

    it("misses for different identities", () => {
        const main = [bar(0), bar(60)];
        expect(getOrBucket(main, [bar(0)])).not.toBe(getOrBucket(main, [bar(0)]));
    });
});
