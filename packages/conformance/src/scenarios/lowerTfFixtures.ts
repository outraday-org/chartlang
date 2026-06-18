// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { inputBarPoint } from "../inputBarPoint.js";

function bar(time: number): Bar {
    return {
        time,
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 100,
        symbol: "TEST",
        interval: "30s",
        hl2: 10,
        hlc3: 10.166666666666666,
        ohlc4: 10.125,
        hlcc4: 10.25,
        point: inputBarPoint(time),
    };
}

/**
 * Synthetic 30-second candles covering the conformance fixture window.
 *
 * @since 0.6
 * @stable
 * @example
 *     // import { LTF_30S_FIXTURE_BARS } from "./lowerTfFixtures";
 *     const fixtureCount = 220;
 *     void fixtureCount;
 */
export const LTF_30S_FIXTURE_BARS: ReadonlyArray<Bar> = Object.freeze(
    Array.from({ length: 220 }, (_, i) => bar(i * 30_000)),
);
