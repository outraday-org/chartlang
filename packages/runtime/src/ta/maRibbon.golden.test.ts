// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { hashFloat64Array, syntheticBars } from "./__fixtures__/syntheticBars";
import { maRibbon } from "./maRibbon";

describe("ta.maRibbon — golden", () => {
    it("matches the pinned per-output hashes for 100 bars × default opts", () => {
        const bars = syntheticBars(100, 42);
        const captured: Record<string, number[]> = {
            ma_10: [],
            ma_20: [],
            ma_30: [],
            ma_40: [],
            ma_50: [],
        };
        harness(bars, bars.length + 1, (bar) => {
            const r = maRibbon("slot", bar.close);
            captured.ma_10.push(r.ma_10.current);
            captured.ma_20.push(r.ma_20.current);
            captured.ma_30.push(r.ma_30.current);
            captured.ma_40.push(r.ma_40.current);
            captured.ma_50.push(r.ma_50.current);
            return null;
        });
        const hashes = {
            ma_10: hashFloat64Array(captured.ma_10),
            ma_20: hashFloat64Array(captured.ma_20),
            ma_30: hashFloat64Array(captured.ma_30),
            ma_40: hashFloat64Array(captured.ma_40),
            ma_50: hashFloat64Array(captured.ma_50),
        };
        expect(hashes).toEqual({
            ma_10: "bbb69e2b",
            ma_20: "d8cd346b",
            ma_30: "a55683ce",
            ma_40: "7278001f",
            ma_50: "a704ee32",
        });
    });
});
