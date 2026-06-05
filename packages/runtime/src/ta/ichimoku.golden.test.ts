// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { ichimoku } from "./ichimoku";

describe("ta.ichimoku — golden", () => {
    it("matches the pinned hashes for 200 bars × default (9, 26, 52, 26)", () => {
        const bars = syntheticBars(200, 42);
        const out = harness(bars, bars.length + 1, () => {
            const i = ichimoku("slot");
            return {
                tenkan: i.tenkan.current,
                kijun: i.kijun.current,
                senkouA: i.senkouA.current,
                senkouB: i.senkouB.current,
                chikou: i.chikou.current,
            };
        });
        // Hashes captured during implementation against
        // syntheticBars(200, 42); re-pin if the math intentionally changes.
        expect(hashFloat64Array(out.map((o) => o.tenkan))).toBe("bb7e5e61");
        expect(hashFloat64Array(out.map((o) => o.kijun))).toBe("dd1a900a");
        expect(hashFloat64Array(out.map((o) => o.senkouA))).toBe("ac62116a");
        expect(hashFloat64Array(out.map((o) => o.senkouB))).toBe("aaa17d57");
        expect(hashFloat64Array(out.map((o) => o.chikou))).toBe("674cb130");
    });
});
