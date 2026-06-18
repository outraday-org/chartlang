// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { appendBarToStream, createStreamState } from "./streamState.js";

const BASE = 1_700_000_000_000;
const DAY = 86_400_000;

function dailyBar(i: number): Bar {
    const time = BASE + i * DAY;
    const close = 100 + i;
    return {
        time,
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 1_000 + i,
        symbol: "GOLD",
        interval: "1D",
        hl2: close,
        hlc3: close,
        ohlc4: close,
        hlcc4: close,
        point: (offset, price) => ({ time: offset === 0 ? time : Number.NaN, price }),
    };
}

describe("bar.point golden over a synthetic daily series", () => {
    it("resolves current / historical / future / out-of-range offsets on the live BarView", () => {
        // capacity = maxLookback + 1; size for 5 bars of history.
        const stream = createStreamState({ interval: "1D", capacity: 6, symbol: "GOLD" });
        for (let i = 0; i < 5; i += 1) appendBarToStream(stream, dailyBar(i));

        const { bar } = stream;
        const lastTime = BASE + 4 * DAY;

        // Current bar.
        expect(bar.point(0, bar.close)).toEqual({ time: lastTime, price: 104 });

        // Historical — real timestamps from the time ring buffer.
        expect(bar.point(-1, 50).time).toBe(BASE + 3 * DAY);
        expect(bar.point(-4, 50).time).toBe(BASE);

        // Out-of-range history degrades to NaN time (no throw).
        const oob = bar.point(-10, 7);
        expect(Number.isNaN(oob.time)).toBe(true);
        expect(oob.price).toBe(7);

        // Future — even daily spacing ⇒ median delta = one day.
        expect(bar.point(3, bar.close)).toEqual({ time: lastTime + 3 * DAY, price: 104 });

        // Price passthrough including NaN.
        expect(bar.point(-2, Number.NaN).price).toBeNaN();
    });

    it("a single-bar stream extrapolates the future from the parsed interval", () => {
        const stream = createStreamState({ interval: "1D", capacity: 2, symbol: "GOLD" });
        appendBarToStream(stream, dailyBar(0));
        // Only one retained bar ⇒ parse "1D" = 86_400s = 86_400_000ms.
        expect(stream.bar.point(2, 0).time).toBe(BASE + 2 * DAY);
    });
});
