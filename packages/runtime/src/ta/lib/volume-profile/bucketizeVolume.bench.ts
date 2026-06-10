// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/bucketize-volume.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import { bench, describe } from "vitest";

import { bucketizeVolumeDetailed } from "./bucketizeVolume.js";
import type { VolumeProfileBar } from "./types.js";

const BARS = buildBars(5_000);
const EDGES = buildEdges(200);

describe("bucketizeVolume hot path", () => {
    bench(
        "bucketizeVolume 5 000 bars × 200 buckets",
        () => {
            const out = bucketizeVolumeDetailed(BARS, EDGES, "upDown");
            if (out.rows.length !== 200) throw new Error("missing rows");
        },
        { iterations: 1 },
    );
});

function buildBars(n: number): Array<VolumeProfileBar> {
    const out = new Array<VolumeProfileBar>(n);
    for (let i = 0; i < n; i += 1) {
        const base = 100 + Math.sin(i * 0.03) * 25;
        out[i] = {
            close: base + 0.5,
            high: base + 1,
            low: base - 1,
            open: base - 0.5,
            time: i,
            volume: 100 + (i % 20),
        };
    }
    return out;
}

function buildEdges(n: number): Float64Array {
    const edges = new Float64Array(n + 1);
    for (let i = 0; i <= n; i += 1) edges[i] = 50 + i * 0.5;
    return edges;
}
