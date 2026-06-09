// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createMultiStreamCandlePump } from "./streamPump";

function bar(i: number, interval = "1m"): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
        volume: 1_000 + i,
        symbol: "DEMO",
        interval,
    };
}

async function collect(source: AsyncIterable<CandleEvent>): Promise<ReadonlyArray<CandleEvent>> {
    const events: CandleEvent[] = [];
    for await (const event of source) events.push(event);
    return events;
}

describe("createMultiStreamCandlePump", () => {
    it("tags secondary close events before the main bar that reaches their time", async () => {
        const main = mockCandleSource([bar(0), bar(1), bar(2)], {
            interval: "1m",
            mode: "stream",
        });
        const secondary = { "1D": [bar(1, "1D")] };

        const events = await collect(createMultiStreamCandlePump({ main, secondary }));

        expect(events.map((event) => event.streamKey ?? "main")).toEqual([
            "main",
            "1D",
            "main",
            "main",
        ]);
    });

    it("passes empty history through without flushing secondary candles", async () => {
        const main = mockCandleSource([], { interval: "1m", mode: "history" });
        const secondary = { "1D": [bar(0, "1D")] };

        const events = await collect(createMultiStreamCandlePump({ main, secondary }));

        expect(events).toEqual([{ kind: "history", bars: [] }]);
    });

    it("flushes secondary candles before a non-empty history boundary", async () => {
        const main = mockCandleSource([bar(1)], { interval: "1m", mode: "history" });
        const secondary = { "1D": [bar(0, "1D")] };

        const events = await collect(createMultiStreamCandlePump({ main, secondary }));

        expect(events.map((event) => event.streamKey ?? "main")).toEqual(["1D", "main"]);
    });
});
