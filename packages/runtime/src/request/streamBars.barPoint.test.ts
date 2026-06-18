// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { appendBarToStream, createStreamState } from "../streamState.js";
import { barFromStream } from "./streamBars.js";

const BASE = 1_700_000_000_000;
const DAY = 86_400_000;

function dailyBar(i: number): Bar {
    const time = BASE + i * DAY;
    const close = 100 + i;
    return {
        time,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        symbol: "SEC",
        interval: "1D",
        hl2: close,
        hlc3: close,
        ohlc4: close,
        hlcc4: close,
        point: (offset, price) => ({ time: offset === 0 ? time : Number.NaN, price }),
    };
}

describe("barFromStream bar.point", () => {
    it("anchors offsets relative to the materialised bar's own age", () => {
        const stream = createStreamState({ interval: "1D", capacity: 6, symbol: "SEC" });
        for (let i = 0; i < 5; i += 1) appendBarToStream(stream, dailyBar(i));

        // Materialise the bar two steps back from the head (age 2 ⇒ i = 2).
        const aged = barFromStream(stream, 2);
        expect(aged.time).toBe(BASE + 2 * DAY);

        // offset 0 ⇒ the aged bar's own time.
        expect(aged.point(0, 5)).toEqual({ time: BASE + 2 * DAY, price: 5 });

        // offset -1 ⇒ one bar before the aged bar (i = 1).
        expect(aged.point(-1, 5).time).toBe(BASE + DAY);

        // future offset extrapolates from the aged bar by the median spacing.
        expect(aged.point(1, 9)).toEqual({ time: BASE + 3 * DAY, price: 9 });
    });
});
