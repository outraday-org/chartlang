// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { inputBarPoint } from "../inputBarPoint.js";

const START_TIME = 1_700_000_000_000;
const MS_PER_DAY = 86_400_000;

/**
 * Secondary daily candles for the `AMEX:SPY` stream used by the two-symbol
 * ratio conformance scenarios. The timestamps match
 * `MTF_DAILY_FIXTURE_BARS` / {@link MTF_QQQ_FIXTURE_BARS} so cross-symbol
 * alignment is trivially no-lookahead; the closes (600/620/640) are distinct
 * from QQQ's (300/310/320) so the SPY/QQQ ratio (~2) lands in a band the main
 * golden stream (~100) never reaches — the conformance-side distinctness proof.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { MTF_SPY_FIXTURE_BARS } from "./multiSymbolFixtures";
 *     void MTF_SPY_FIXTURE_BARS.length;
 */
export const MTF_SPY_FIXTURE_BARS: ReadonlyArray<Bar> = Object.freeze([
    makeBar(0, 600, "AMEX:SPY"),
    makeBar(4, 620, "AMEX:SPY"),
    makeBar(8, 640, "AMEX:SPY"),
]);

/**
 * Secondary daily candles for the `NASDAQ:QQQ` stream used by the two-symbol
 * ratio conformance scenarios. Timestamp-aligned to
 * {@link MTF_SPY_FIXTURE_BARS}; the distinct closes (300/310/320) keep the
 * SPY/QQQ ratio finite, ≠ 1, and well away from the main golden band.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { MTF_QQQ_FIXTURE_BARS } from "./multiSymbolFixtures";
 *     void MTF_QQQ_FIXTURE_BARS.length;
 */
export const MTF_QQQ_FIXTURE_BARS: ReadonlyArray<Bar> = Object.freeze([
    makeBar(0, 300, "NASDAQ:QQQ"),
    makeBar(4, 310, "NASDAQ:QQQ"),
    makeBar(8, 320, "NASDAQ:QQQ"),
]);

function makeBar(i: number, close: number, symbol: string): Bar {
    const open = close - 1;
    const high = close + 2;
    const low = close - 2;
    const hl2 = (high + low) / 2;
    const hlc3 = (high + low + close) / 3;
    const time = START_TIME + i * MS_PER_DAY;
    return {
        time,
        open,
        high,
        low,
        close,
        volume: 10_000 + i,
        symbol,
        interval: "1D",
        hl2,
        hlc3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        point: inputBarPoint(time),
    };
}
