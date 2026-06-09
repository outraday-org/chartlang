// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

const START_TIME = 1_700_000_000_000;
const MS_PER_DAY = 86_400_000;

/**
 * Secondary daily candles used by MTF conformance scenarios.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures";
 *     void MTF_DAILY_FIXTURE_BARS.length;
 */
export const MTF_DAILY_FIXTURE_BARS: ReadonlyArray<Bar> = Object.freeze([
    makeBar(0, 510),
    makeBar(4, 620),
    makeBar(8, 730),
]);

function makeBar(i: number, close: number): Bar {
    const open = close - 1;
    const high = close + 2;
    const low = close - 2;
    const hl2 = (high + low) / 2;
    const hlc3 = (high + low + close) / 3;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 10_000 + i,
        symbol: "GOLDEN",
        interval: "1D",
        hl2,
        hlc3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}
