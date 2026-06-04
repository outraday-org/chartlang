// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

function bar(i: number, open: number, high: number, low: number, close: number): Bar {
    return {
        time: START_TIME + i * MS_PER_DAY,
        open,
        high,
        low,
        close,
        volume: 1_000 + i * 10,
        symbol: "TEST",
        interval: "1D",
    };
}

/**
 * Ten-bar deterministic OHLC fixture used by candle-render unit tests
 * and the local `runRendererLoop` smoke test. Bull / bear pattern is
 * chosen so the renderer exercises both `palette.candleBullBody` and
 * `palette.candleBearBody`.
 */
export const SAMPLE_BARS: ReadonlyArray<Bar> = Object.freeze([
    bar(0, 100, 105, 99, 104),
    bar(1, 104, 106, 102, 103),
    bar(2, 103, 108, 101, 107),
    bar(3, 107, 109, 105, 108),
    bar(4, 108, 110, 104, 106),
    bar(5, 106, 111, 105, 110),
    bar(6, 110, 113, 109, 112),
    bar(7, 112, 114, 108, 109),
    bar(8, 109, 112, 107, 111),
    bar(9, 111, 115, 110, 114),
]);
