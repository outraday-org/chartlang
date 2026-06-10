// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { mockCandleSource } from "./mockCandleSource.js";
import type { CandleEvent } from "../types.js";

function makeBar(time: number, close: number): Bar {
    return {
        time,
        open: close,
        high: close,
        low: close,
        close,
        volume: 0,
        symbol: "TEST",
        interval: "1D",
    };
}

async function collect(it: AsyncIterable<CandleEvent>): Promise<CandleEvent[]> {
    const out: CandleEvent[] = [];
    for await (const e of it) out.push(e);
    return out;
}

describe("mockCandleSource", () => {
    it("history mode emits exactly one { kind: 'history', bars } event", async () => {
        const bars: ReadonlyArray<Bar> = [makeBar(0, 1), makeBar(60_000, 2)];
        const events = await collect(mockCandleSource(bars, { interval: "1D" }));
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ kind: "history", bars });
    });

    it("stream mode emits one { kind: 'close', bar } per bar in order", async () => {
        const bars: ReadonlyArray<Bar> = [makeBar(0, 1), makeBar(60_000, 2), makeBar(120_000, 3)];
        const events = await collect(mockCandleSource(bars, { interval: "1D", mode: "stream" }));
        expect(events).toHaveLength(3);
        for (let i = 0; i < events.length; i++) {
            expect(events[i]).toEqual({ kind: "close", bar: bars[i] });
        }
    });

    it("history mode with an empty array yields a single empty history batch", async () => {
        const events = await collect(mockCandleSource([], { interval: "1D" }));
        expect(events).toEqual([{ kind: "history", bars: [] }]);
    });

    it("stream mode with an empty array yields nothing", async () => {
        const events = await collect(mockCandleSource([], { interval: "1D", mode: "stream" }));
        expect(events).toEqual([]);
    });

    it("defaults to interval 1D + history mode when opts are omitted", async () => {
        const events = await collect(mockCandleSource([]));
        expect(events).toEqual([{ kind: "history", bars: [] }]);
    });

    describe("history-then-stream mode", () => {
        const bars: ReadonlyArray<Bar> = [
            makeBar(0, 1),
            makeBar(60_000, 2),
            makeBar(120_000, 3),
            makeBar(180_000, 4),
        ];

        it("emits one history batch then a close-per-bar for the trailing tail", async () => {
            const events = await collect(
                mockCandleSource(bars, {
                    interval: "1D",
                    mode: "history-then-stream",
                    streamTail: 2,
                }),
            );
            expect(events).toHaveLength(3);
            expect(events[0]).toEqual({ kind: "history", bars: bars.slice(0, 2) });
            expect(events[1]).toEqual({ kind: "close", bar: bars[2] });
            expect(events[2]).toEqual({ kind: "close", bar: bars[3] });
        });

        it("defaults streamTail to 1 when omitted", async () => {
            const events = await collect(
                mockCandleSource(bars, { interval: "1D", mode: "history-then-stream" }),
            );
            expect(events).toHaveLength(2);
            expect(events[0]).toEqual({ kind: "history", bars: bars.slice(0, bars.length - 1) });
            expect(events[1]).toEqual({ kind: "close", bar: bars[bars.length - 1] });
        });

        it("clamps streamTail at bars.length (all bars stream after an empty history)", async () => {
            const events = await collect(
                mockCandleSource(bars, {
                    interval: "1D",
                    mode: "history-then-stream",
                    streamTail: 100,
                }),
            );
            expect(events).toHaveLength(bars.length + 1);
            expect(events[0]).toEqual({ kind: "history", bars: [] });
            for (let i = 0; i < bars.length; i++) {
                expect(events[i + 1]).toEqual({ kind: "close", bar: bars[i] });
            }
        });

        it("clamps a negative streamTail to 0 (degenerates to a pure history batch)", async () => {
            const events = await collect(
                mockCandleSource(bars, {
                    interval: "1D",
                    mode: "history-then-stream",
                    streamTail: -5,
                }),
            );
            expect(events).toEqual([{ kind: "history", bars }]);
        });

        it("treats a non-finite streamTail as 0", async () => {
            const events = await collect(
                mockCandleSource(bars, {
                    interval: "1D",
                    mode: "history-then-stream",
                    streamTail: Number.NaN,
                }),
            );
            expect(events).toEqual([{ kind: "history", bars }]);
        });

        it("with an empty bars array yields a single empty history batch", async () => {
            const events = await collect(
                mockCandleSource([], {
                    interval: "1D",
                    mode: "history-then-stream",
                    streamTail: 5,
                }),
            );
            expect(events).toEqual([{ kind: "history", bars: [] }]);
        });
    });
});
