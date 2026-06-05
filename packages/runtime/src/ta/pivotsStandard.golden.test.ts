// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { pivotsStandard } from "./pivotsStandard";

const MS_PER_DAY = 86_400_000;

/**
 * syntheticBars steps by 60 000 ms (1 minute). 3000 bars ≈ 2.08 UTC
 * days, enough to trigger one day boundary and produce finite pivot
 * output for the second day. Each base bar's time is rebased to align
 * the first bar with day-0 UTC for deterministic boundary fire.
 */
function syntheticDailyBars(n: number, seed: number): Bar[] {
    const bars = syntheticBars(n, seed);
    const baseDay = Math.floor(bars[0].time / MS_PER_DAY) * MS_PER_DAY;
    return bars.map((b, i) => ({ ...b, time: baseDay + i * 60_000 }));
}

describe("ta.pivotsStandard — golden", () => {
    it("matches the pinned hashes for 3000 minute-bars × classic system", () => {
        const bars = syntheticDailyBars(3000, 42);
        const out = harness(bars, bars.length + 1, () => {
            const p = pivotsStandard("slot", { system: "classic" });
            return {
                pp: p.pp.current,
                r1: p.r1.current,
                s1: p.s1.current,
                r2: p.r2.current,
                s2: p.s2.current,
                r3: p.r3.current,
                s3: p.s3.current,
            };
        });
        // Hashes captured during implementation against
        // syntheticDailyBars(3000, 42) with system="classic"; re-pin
        // if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.pp))).toBe("e4f59c85");
        expect(hashFloat64Array(out.map((o) => o.r1))).toBe("7882a7c5");
        expect(hashFloat64Array(out.map((o) => o.s1))).toBe("f98631c5");
        expect(hashFloat64Array(out.map((o) => o.r2))).toBe("76bbedcd");
        expect(hashFloat64Array(out.map((o) => o.s2))).toBe("4de66555");
        expect(hashFloat64Array(out.map((o) => o.r3))).toBe("b9a45c45");
        expect(hashFloat64Array(out.map((o) => o.s3))).toBe("a4f74185");
    });
});
