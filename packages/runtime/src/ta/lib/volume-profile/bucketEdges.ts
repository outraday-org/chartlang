// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucket-edges.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { RowsLayout } from "./types.js";

/**
 * Build `bucketCount + 1` price edges for a volume profile.
 *
 * @formula PLAN §9.2 — `ticksPerRow`: width = rowSize * tickSize;
 *          `numberOfRows`: width = (priceMax - priceMin) / rowSize.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const edges = buildBucketEdges(100, 105, "ticksPerRow", 10, 0.01);
 */
export function buildBucketEdges(
    priceMin: number,
    priceMax: number,
    rowsLayout: RowsLayout,
    rowSize: number,
    tickSize: number,
): Float64Array {
    if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax) || rowSize <= 0) {
        return new Float64Array([priceMin, priceMin]);
    }
    if (priceMax <= priceMin) return new Float64Array([priceMin, priceMin]);

    if (rowsLayout === "ticksPerRow") {
        const bucketWidth = rowSize * tickSize;
        if (bucketWidth <= 0) return new Float64Array([priceMin, priceMin]);

        const startEdge = Math.floor(priceMin / bucketWidth) * bucketWidth;
        const endEdge = Math.ceil(priceMax / bucketWidth) * bucketWidth;
        const count = Math.max(1, Math.round((endEdge - startEdge) / bucketWidth));
        const edges = new Float64Array(count + 1);
        for (let i = 0; i <= count; i += 1) edges[i] = startEdge + i * bucketWidth;
        return edges;
    }

    const count = Math.max(1, Math.floor(rowSize));
    const width = (priceMax - priceMin) / count;
    const edges = new Float64Array(count + 1);
    for (let i = 0; i <= count; i += 1) edges[i] = priceMin + i * width;
    return edges;
}
