// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/value-area.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { describe, expect, it } from "vitest";

import { GOLDEN_VALUE_AREA } from "./__fixtures__/volumeProfileFixtures.js";
import type { VolumeProfileRow } from "./types.js";
import { computeValueArea } from "./valueArea.js";

function row(volume: number, idx: number): VolumeProfileRow {
    return { downVolume: 0, high: idx + 1, low: idx, mid: idx + 0.5, upVolume: volume, volume };
}

describe("computeValueArea", () => {
    it("symmetric distribution expands evenly", () => {
        const rows = [row(10, 0), row(10, 1), row(30, 2), row(10, 3), row(10, 4)];
        const result = computeValueArea(rows, 70, 2);
        expect(result.valIdx).toBeLessThanOrEqual(2);
        expect(result.vahIdx).toBeGreaterThanOrEqual(2);
        expect(result).toMatchObject(GOLDEN_VALUE_AREA);
    });

    it("asymmetric distribution expands toward the heavier side", () => {
        const rows = [row(1, 0), row(1, 1), row(30, 2), row(20, 3), row(20, 4)];
        const result = computeValueArea(rows, 70, 2);
        expect(result.vahIdx).toBe(4);
        expect(result.valIdx).toBe(2);
    });

    it("edge-case POC at array boundary halts cleanly", () => {
        const rows = [row(50, 0), row(10, 1), row(10, 2), row(10, 3), row(10, 4)];
        const result = computeValueArea(rows, 70, 0);
        expect(result.valIdx).toBe(0);
        expect(result.vahIdx).toBeGreaterThanOrEqual(1);
    });

    it("handles single-neighbour expansion without taking a pair", () => {
        const result = computeValueArea([row(50, 0), row(10, 1)], 100, 0);
        expect(result.valIdx).toBe(0);
        expect(result.vahIdx).toBe(1);
    });

    it("valueAreaPct 100 captures every bucket", () => {
        const rows = [row(10, 0), row(20, 1), row(30, 2), row(20, 3), row(10, 4)];
        const result = computeValueArea(rows, 100, 2);
        expect(result.valIdx).toBe(0);
        expect(result.vahIdx).toBe(4);
    });

    it("empty or invalid POC rows return NaN prices", () => {
        const result = computeValueArea([], 70, -1);
        expect(result.vahIdx).toBe(-1);
        expect(result.valIdx).toBe(-1);
        expect(Number.isNaN(result.poc)).toBe(true);
        expect(Number.isNaN(computeValueArea([row(1, 0)], 70, 2).valHigh)).toBe(true);
    });

    it("clamps valueAreaPct below zero to the POC bucket", () => {
        const result = computeValueArea([row(10, 0), row(100, 1), row(10, 2)], -1);
        expect(result.pocIdx).toBe(1);
        expect(result.valIdx).toBe(1);
        expect(result.vahIdx).toBe(1);
    });
});
