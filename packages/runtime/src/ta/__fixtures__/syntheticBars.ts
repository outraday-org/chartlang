// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Mulberry32 — tiny deterministic 32-bit PRNG used by the golden /
 * property tests. Each call returns `[0, 1)`. Same seed → same
 * sequence across runs, machines, and Node versions.
 */
export function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Synthesise `n` deterministic OHLCV bars suitable for golden / bench
 * tests. The price walk drifts around a base and the spread keeps high
 * ≥ max(open, close), low ≤ min(open, close) so every bar passes a
 * basic OHLC sanity check. Volume is non-negative.
 */
export function syntheticBars(n: number, seed = 1): Bar[] {
    const rand = mulberry32(seed);
    const bars: Bar[] = [];
    let close = 100;
    const base = 1_700_000_000_000;
    for (let i = 0; i < n; i += 1) {
        const open = close;
        const drift = (rand() - 0.5) * 2;
        close = open + drift;
        const spread = Math.abs((rand() - 0.5) * 1.5);
        const high = Math.max(open, close) + spread;
        const low = Math.min(open, close) - spread;
        const volume = Math.floor(rand() * 10_000);
        bars.push({
            time: base + i * 60_000,
            open,
            high,
            low,
            close,
            volume,
            hl2: (high + low) / 2,
            hlc3: (high + low + close) / 3,
            ohlc4: (open + high + low + close) / 4,
            hlcc4: (high + low + close * 2) / 4,
            symbol: "TEST",
            interval: "1m",
        });
    }
    return bars;
}

/**
 * Simple FNV-1a 32-bit hash of a numeric array. Used to pin golden
 * outputs without writing a 100-entry JSON file per primitive. NaN
 * encodes as a fixed token so the hash is deterministic.
 */
export function hashFloat64Array(values: ReadonlyArray<number>): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        const repr = Number.isNaN(v) ? "NaN" : v.toPrecision(12);
        for (let j = 0; j < repr.length; j += 1) {
            h ^= repr.charCodeAt(j);
            h = Math.imul(h, 0x01000193);
        }
    }
    return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * FNV-1a hash of a boolean array — analogue of {@link hashFloat64Array}
 * for the cross primitives.
 */
export function hashBoolArray(values: ReadonlyArray<boolean>): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < values.length; i += 1) {
        h ^= values[i] ? 1 : 0;
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
}
