// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/value-area.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { VolumeProfileRow } from "./types";
import { computeValueArea } from "./valueArea";

function rows(volumes: ReadonlyArray<number>): Array<VolumeProfileRow> {
    return volumes.map((volume, index) => ({
        downVolume: 0,
        high: index + 1,
        low: index,
        mid: index + 0.5,
        upVolume: volume,
        volume,
    }));
}

describe("computeValueArea — property invariants", () => {
    it("keeps POC inside the bucket array", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ max: 10_000, min: 0.01, noNaN: true }), {
                    maxLength: 40,
                    minLength: 1,
                }),
                (volumes) => {
                    const result = computeValueArea(rows(volumes), 70);
                    expect(result.pocIdx).toBeGreaterThanOrEqual(0);
                    expect(result.pocIdx).toBeLessThan(volumes.length);
                },
            ),
        );
    });

    it("covers at least valueAreaPct × totalVolume unless all buckets are exhausted", () => {
        fc.assert(
            fc.property(
                fc.array(fc.double({ max: 10_000, min: 0.01, noNaN: true }), {
                    maxLength: 40,
                    minLength: 1,
                }),
                fc.double({ max: 100, min: 1, noNaN: true }),
                (volumes, pct) => {
                    const result = computeValueArea(rows(volumes), pct);
                    const total = volumes.reduce((sum, volume) => sum + volume, 0);
                    expect(result.cumulativeVolume).toBeGreaterThanOrEqual(
                        total * (pct / 100) - 1e-9,
                    );
                },
            ),
        );
    });
});
