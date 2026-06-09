// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/developing-series.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeDevelopingSeries } from "./developingSeries";
import type { VolumeProfileBar } from "./types";

describe("computeDevelopingSeries — property invariants", () => {
    it("output lengths equal lane bar count", () => {
        fc.assert(
            fc.property(fc.integer({ max: 80, min: 0 }), (n) => {
                const bars = new Array<VolumeProfileBar>(n);
                for (let i = 0; i < n; i += 1) {
                    bars[i] = { close: 2, high: 3, low: 1, open: 2, time: i, volume: 10 };
                }
                const result = computeDevelopingSeries({
                    config: { rowSize: 5, valueAreaPct: 70 },
                    finerBars: [],
                    laneBars: bars,
                    windowFromIdx: 0,
                    windowToIdx: n - 1,
                });
                expect(result.developingPoc.length).toBe(n);
                expect(result.developingVahHigh.length).toBe(n);
                expect(result.developingVahLow.length).toBe(n);
            }),
        );
    });
});
