// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createStreamState, updateFallbackViewport } from "./streamState.js";

describe("createStreamState", () => {
    it("constructs the full per-stream shape with the supplied symbol/interval", () => {
        const stream = createStreamState({
            interval: "1D",
            capacity: 5,
            symbol: "AAPL",
        });
        expect(stream.interval).toBe("1D");
        expect(stream.bar.symbol).toBe("AAPL");
        expect(stream.bar.interval).toBe("1D");
        expect(stream.bar.time).toBe(0);
        // The OHLCV + derived bar fields are the cached series views (one
        // identity per buffer) — before the first bar the buffers are empty,
        // so every numeric field coerces to NaN (`.current` / `+bar.x`).
        expect(stream.bar.close).toBe(stream.seriesViews.close);
        expect(stream.bar.volume).toBe(stream.seriesViews.volume);
        expect(stream.bar.volume.current).toBeNaN();
        expect(+stream.bar.volume).toBeNaN();
        expect(stream.bar.open.current).toBeNaN();
        expect(stream.bar.high.current).toBeNaN();
        expect(stream.bar.low.current).toBeNaN();
        expect(stream.bar.close.current).toBeNaN();
        expect(stream.bar.hl2.current).toBeNaN();
        expect(stream.bar.hlc3.current).toBeNaN();
        expect(stream.bar.ohlc4.current).toBeNaN();
        expect(stream.bar.hlcc4.current).toBeNaN();
    });

    it("sizes every OHLCV ring buffer to the supplied capacity", () => {
        const { ohlcv } = createStreamState({
            interval: "5m",
            capacity: 12,
            symbol: "BTCUSD",
        });
        expect(ohlcv.time.capacity).toBe(12);
        expect(ohlcv.open.capacity).toBe(12);
        expect(ohlcv.high.capacity).toBe(12);
        expect(ohlcv.low.capacity).toBe(12);
        expect(ohlcv.close.capacity).toBe(12);
        expect(ohlcv.volume.capacity).toBe(12);
        expect(ohlcv.hl2.capacity).toBe(12);
        expect(ohlcv.hlc3.capacity).toBe(12);
        expect(ohlcv.ohlc4.capacity).toBe(12);
        expect(ohlcv.hlcc4.capacity).toBe(12);
        expect(ohlcv.close.length).toBe(0);
    });

    it("wires Series<number> views into each OHLCV buffer", () => {
        const { ohlcv, seriesViews } = createStreamState({
            interval: "1D",
            capacity: 3,
            symbol: "AAPL",
        });
        ohlcv.close.append(100);
        ohlcv.close.append(101);
        expect(seriesViews.close.current).toBe(101);
        expect(seriesViews.close[1]).toBe(100);
        expect(seriesViews.close.length).toBe(2);

        ohlcv.volume.append(1000);
        expect(seriesViews.volume.current).toBe(1000);
        expect(seriesViews.time.current).toBeNaN();
    });

    it("Series view identity is stable across appends", () => {
        const { ohlcv, seriesViews } = createStreamState({
            interval: "1D",
            capacity: 3,
            symbol: "AAPL",
        });
        const closeRef = seriesViews.close;
        ohlcv.close.append(1);
        ohlcv.close.append(2);
        ohlcv.close.append(3);
        ohlcv.close.append(4);
        expect(seriesViews.close).toBe(closeRef);
    });

    it("taSlots starts as an empty Map", () => {
        const { taSlots } = createStreamState({
            interval: "1D",
            capacity: 3,
            symbol: "AAPL",
        });
        expect(taSlots).toBeInstanceOf(Map);
        expect(taSlots.size).toBe(0);
        taSlots.set("slot#0", { running: 1 });
        expect(taSlots.size).toBe(1);
        expect(taSlots.get("slot#0")).toEqual({ running: 1 });
    });

    it("each call returns a fresh StreamState with independent state", () => {
        const a = createStreamState({ interval: "1D", capacity: 2, symbol: "A" });
        const b = createStreamState({ interval: "1D", capacity: 2, symbol: "B" });
        expect(a).not.toBe(b);
        expect(a.ohlcv).not.toBe(b.ohlcv);
        expect(a.bar).not.toBe(b.bar);
        expect(a.taSlots).not.toBe(b.taSlots);
        a.ohlcv.close.append(1);
        expect(b.ohlcv.close.length).toBe(0);
    });

    it("serialises and restores raw OHLCV buffers", () => {
        const source = createStreamState({ interval: "1m", capacity: 3, symbol: "AAPL" });
        source.ohlcv.time.append(1);
        source.ohlcv.open.append(10);
        source.ohlcv.high.append(12);
        source.ohlcv.low.append(9);
        source.ohlcv.close.append(11);
        source.ohlcv.volume.append(100);
        source.ohlcv.hl2.append(10.5);
        source.ohlcv.hlc3.append(10.666666666666666);
        source.ohlcv.ohlc4.append(10.5);
        source.ohlcv.hlcc4.append(10.75);
        source.ohlcv.time.append(2);
        source.ohlcv.open.append(11);
        source.ohlcv.high.append(13);
        source.ohlcv.low.append(10);
        source.ohlcv.close.append(12);
        source.ohlcv.volume.append(101);
        source.ohlcv.hl2.append(11.5);
        source.ohlcv.hlc3.append(11.666666666666666);
        source.ohlcv.ohlc4.append(11.5);
        source.ohlcv.hlcc4.append(11.75);
        source.bar.interval = "1m";

        const snapshot = source.serialiseSnapshot();
        const restored = createStreamState({ interval: "1m", capacity: 3, symbol: "AAPL" });
        restored.restoreFromSnapshot(snapshot);

        expect(snapshot.buffers.close).toEqual([11, 12, 0]);
        expect(restored.seriesViews.close.current).toBe(12);
        expect(restored.seriesViews.close[1]).toBe(11);
        expect(restored.seriesViews.hl2.current).toBe(11.5);
        expect(restored.bar.time).toBe(2);
        expect(restored.bar.interval).toBe("1m");
        // bar.close is the restored close view — coerces to the head and indexes history
        expect(+restored.bar.close).toBe(12);
        expect(restored.bar.close.current).toBe(12);
        expect(restored.bar.close[1]).toBe(11);
    });

    it("rejects stream snapshots whose buffers do not match capacity", () => {
        const restored = createStreamState({ interval: "1m", capacity: 2, symbol: "AAPL" });
        expect(() =>
            restored.restoreFromSnapshot({
                interval: "1m",
                headIndex: 0,
                filled: 1,
                buffers: {
                    time: [1],
                    open: [10],
                    high: [11],
                    low: [9],
                    close: [10.5],
                    volume: [100],
                },
            }),
        ).toThrow("invalid ring buffer snapshot");
    });

    it("restores an empty snapshot back to NaN bar sentinels", () => {
        const restored = createStreamState({ interval: "1m", capacity: 2, symbol: "AAPL" });
        restored.ohlcv.close.append(10);

        restored.restoreFromSnapshot({
            interval: "1m",
            headIndex: -1,
            filled: 0,
            buffers: {
                time: [null, null],
                open: [null, null],
                high: [null, null],
                low: [null, null],
                close: [null, null],
                volume: [null, null],
            },
        });

        expect(restored.bar.time).toBe(0);
        expect(restored.bar.open.current).toBeNaN();
        expect(restored.bar.high.current).toBeNaN();
        expect(restored.bar.low.current).toBeNaN();
        expect(restored.bar.close.current).toBeNaN();
        expect(restored.bar.volume.current).toBeNaN();
        expect(restored.bar.hl2.current).toBeNaN();
        expect(restored.bar.hlc3.current).toBeNaN();
        expect(restored.bar.ohlc4.current).toBeNaN();
        expect(restored.bar.hlcc4.current).toBeNaN();
    });

    it("restores null raw values as NaN-derived values", () => {
        const restored = createStreamState({ interval: "1m", capacity: 2, symbol: "AAPL" });

        restored.restoreFromSnapshot({
            interval: "1m",
            headIndex: 0,
            filled: 1,
            buffers: {
                time: [1, null],
                open: [10, null],
                high: [null, null],
                low: [9, null],
                close: [11, null],
                volume: [100, null],
            },
        });

        expect(restored.bar.high.current).toBeNaN();
        expect(restored.bar.hl2.current).toBeNaN();
        expect(restored.bar.hlc3.current).toBeNaN();
        expect(restored.bar.ohlc4.current).toBeNaN();
        expect(restored.bar.hlcc4.current).toBeNaN();
        expect(restored.seriesViews.hl2.current).toBeNaN();
    });

    it("falls back to toTime when fallback viewport fromTime is not finite", () => {
        const stream = createStreamState({ interval: "1m", capacity: 2, symbol: "AAPL" });
        stream.ohlcv.time.append(Number.NaN);
        stream.ohlcv.time.append(10);

        updateFallbackViewport(stream, 2);

        expect(stream.bar.viewport).toEqual({ fromTime: 10, toTime: 10 });
    });
});
