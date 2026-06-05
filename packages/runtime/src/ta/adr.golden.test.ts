// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { adr } from "./adr";
import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, mulberry32 } from "./__fixtures__/syntheticBars";

const MS_PER_DAY = 86_400_000;
const BASE = 1_699_920_000_000;

/**
 * Daily-cadence synthetic bars seeded by Mulberry32. Each bar has its
 * own UTC day key so ADR's calendar-day boundary commits once per bar
 * (matching the canonical "1 daily bar per UTC day" cadence).
 */
function syntheticDailyBars(n: number, seed: number): Bar[] {
    const rand = mulberry32(seed);
    const bars: Bar[] = [];
    for (let i = 0; i < n; i += 1) {
        const base = 100 + rand() * 50;
        const range = 1 + rand() * 10;
        bars.push({
            time: BASE + i * MS_PER_DAY,
            open: base,
            high: base + range,
            low: base,
            close: base,
            volume: 0,
            symbol: "T",
            interval: "1d",
        });
    }
    return bars;
}

describe("ta.adr — golden", () => {
    it("matches the pinned hash for 100 daily bars × length=14", () => {
        const bars = syntheticDailyBars(100, 42);
        const out = harness(bars, bars.length + 1, () => adr("slot", { length: 14 }).current);
        const h = hashFloat64Array(out);
        // Pinned via the first deterministic run on this fixture; re-pin
        // when the math intentionally changes.
        expect(h).toBe("0fa7fd9a");
    });
});
