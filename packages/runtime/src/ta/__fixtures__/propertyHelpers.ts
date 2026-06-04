// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";

/**
 * Arbitrary bar generator with finite OHLC that respect basic candle
 * sanity (high ≥ max(open, close); low ≤ min). Volume always
 * non-negative. Used by every `<id>.property.test.ts`.
 */
export const arbBar: fc.Arbitrary<Bar> = fc
    .tuple(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.1, max: 20, noNaN: true }),
        fc.integer({ min: 0, max: 10_000 }),
    )
    .map(([open, close, spread, volume], _i): Bar => {
        const high = Math.max(open, close) + spread;
        const low = Math.min(open, close) - spread;
        return {
            time: 1_700_000_000_000,
            open,
            high,
            low,
            close,
            volume,
            symbol: "T",
            interval: "1m",
        };
    });
