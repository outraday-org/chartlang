// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/value-area.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { ValueAreaResult, VolumeProfileRow } from "./types.js";

/**
 * Compute greedy expand-from-POC value-area bounds.
 *
 * @formula PLAN §9.2 — start at POC, then absorb the larger of the
 *          next two above-buckets vs below-buckets until target volume.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const va = computeValueArea(rows, 70);
 */
export function computeValueArea(
    rows: ReadonlyArray<VolumeProfileRow>,
    valueAreaPct = 70,
    pocIdx: number = findPocIndex(rows),
): ValueAreaResult {
    if (rows.length === 0 || pocIdx < 0 || pocIdx >= rows.length) {
        return {
            cumulativeVolume: 0,
            poc: Number.NaN,
            pocIdx,
            vahIdx: pocIdx,
            valHigh: Number.NaN,
            valIdx: pocIdx,
            valLow: Number.NaN,
        };
    }

    const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
    const targetPct = Math.max(0, Math.min(100, valueAreaPct));
    const target = totalVolume * (targetPct / 100);
    let lowIdx = pocIdx;
    let highIdx = pocIdx;
    let cumulative = rows[pocIdx].volume;

    while (cumulative < target && (lowIdx > 0 || highIdx + 1 < rows.length)) {
        const aboveAvailable = highIdx + 1 < rows.length;
        const belowAvailable = lowIdx - 1 >= 0;

        let aboveSum = 0;
        if (aboveAvailable) {
            aboveSum = rows[highIdx + 1].volume;
            if (highIdx + 2 < rows.length) aboveSum += rows[highIdx + 2].volume;
        }

        let belowSum = 0;
        if (belowAvailable) {
            belowSum = rows[lowIdx - 1].volume;
            if (lowIdx - 2 >= 0) belowSum += rows[lowIdx - 2].volume;
        }

        if (aboveAvailable && (!belowAvailable || aboveSum >= belowSum)) {
            const takeTwo = highIdx + 2 < rows.length;
            cumulative += rows[highIdx + 1].volume;
            highIdx += 1;
            if (takeTwo && cumulative < target) {
                cumulative += rows[highIdx + 1].volume;
                highIdx += 1;
            }
        } else {
            const takeTwo = lowIdx - 2 >= 0;
            cumulative += rows[lowIdx - 1].volume;
            lowIdx -= 1;
            if (takeTwo && cumulative < target) {
                cumulative += rows[lowIdx - 1].volume;
                lowIdx -= 1;
            }
        }
    }

    return {
        cumulativeVolume: cumulative,
        poc: rows[pocIdx].mid,
        pocIdx,
        vahIdx: highIdx,
        valHigh: rows[highIdx].high,
        valIdx: lowIdx,
        valLow: rows[lowIdx].low,
    };
}

function findPocIndex(rows: ReadonlyArray<VolumeProfileRow>): number {
    let pocIdx = -1;
    let pocVolume = -1;
    for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].volume > pocVolume) {
            pocIdx = i;
            pocVolume = rows[i].volume;
        }
    }
    return pocIdx;
}
