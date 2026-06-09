// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/developing-series.test.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { VolumeProfileBar } from "../types";

export function bar(opts: {
    close: number;
    high: number;
    low: number;
    open: number;
    volume: number;
    time?: number;
}): VolumeProfileBar {
    return {
        close: opts.close,
        high: opts.high,
        low: opts.low,
        open: opts.open,
        time: opts.time ?? 0,
        volume: opts.volume,
    };
}

export function syntheticProfileBars(n: number): Array<VolumeProfileBar> {
    const out = new Array<VolumeProfileBar>(n);
    for (let i = 0; i < n; i += 1) {
        const base = 100 + Math.sin(i * 0.1) * 5;
        out[i] = {
            close: base + 0.2,
            high: base + 0.5,
            low: base - 0.5,
            open: base - 0.2,
            time: i * 60_000,
            volume: 100,
        };
    }
    return out;
}

export const GOLDEN_BUCKETS = [
    { price: 100.5, volume: 100 },
    { price: 101.5, volume: 100 },
] as const;

export const GOLDEN_VALUE_AREA = {
    poc: 2.5,
    valHigh: 5,
    valLow: 2,
} as const;
