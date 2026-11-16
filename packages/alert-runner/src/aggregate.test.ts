// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createBarAggregator } from "./aggregate.js";
import type { AlertBar } from "./types.js";

const M = 60_000;
const H = 60 * M;

const bar = (
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume = 1,
): AlertBar => ({
    time,
    open,
    high,
    low,
    close,
    volume,
});

describe("createBarAggregator", () => {
    it("rolls ticks into bars and closes on the first later sample", () => {
        const agg = createBarAggregator({ interval: "1h" });
        expect(agg.currentBar()).toBeNull();
        expect(agg.ingestTick(10, 5 * M, 2)).toEqual({
            closed: null,
            current: bar(0, 10, 10, 10, 10, 2),
        });
        agg.ingestTick(12, 10 * M);
        agg.ingestTick(9, 20 * M, 3);
        expect(agg.currentBarSource()).toBe("live");
        const { closed, current } = agg.ingestTick(11, H + M);
        expect(closed).toEqual(bar(0, 10, 12, 9, 9, 5));
        expect(current).toEqual(bar(H, 11, 11, 11, 11, 0));
        // An older sample never regresses the stream.
        expect(agg.ingestTick(50, 30 * M)).toEqual({
            closed: null,
            current: bar(H, 11, 11, 11, 11, 0),
        });
    });

    it("folds finer bars and ignores a replayed one", () => {
        const agg = createBarAggregator({ interval: "5m" });
        agg.ingestBar(bar(0, 1, 3, 0.5, 2, 10));
        agg.ingestBar(bar(M, 2, 4, 1, 3, 5));
        expect(agg.ingestBar(bar(M, 2, 9, 1, 3, 5)).current).toEqual(bar(0, 1, 4, 0.5, 3, 15));
        const { closed } = agg.ingestBar(bar(5 * M, 3, 3, 3, 3, 1));
        expect(closed).toEqual(bar(0, 1, 4, 0.5, 3, 15));
    });

    it("closes a due bar on the clock alone and never re-opens it", () => {
        const agg = createBarAggregator({ interval: "1h" });
        expect(agg.closeIfDue(H)).toBeNull();
        agg.ingestTick(10, M);
        expect(agg.closeIfDue(30 * M)).toBeNull();
        expect(agg.closeIfDue(H)).toEqual(bar(0, 10, 10, 10, 10, 0));
        expect(agg.currentBar()).toBeNull();
        expect(agg.ingestTick(99, 40 * M).current).toBeNull();
        expect(agg.seedFormingBar(bar(0, 1, 1, 1, 1))).toBe(false);
        expect(agg.ingestTick(12, H + M).closed).toBeNull();
    });

    it("never re-emits a closed history seed", () => {
        const agg = createBarAggregator({ interval: "1h" });
        agg.seedFromHistory([]);
        expect(agg.currentBar()).toBeNull();
        agg.seedFromHistory([bar(0, 1, 2, 0, 1, 7), bar(H, 1, 5, 0, 4, 7)]);
        expect(agg.currentBar()).toBeNull();
        expect(agg.currentBarSource()).toBeNull();
        expect(agg.closeIfDue(3 * H)).toBeNull();
        expect(agg.ingestTick(100, H + M)).toEqual({ closed: null, current: null });
        expect(agg.ingestTick(6, 2 * H + M)).toEqual({
            closed: null,
            current: bar(2 * H, 6, 6, 6, 6, 0),
        });
    });

    it("seeds the forming bar from a provider and merges forward only", () => {
        const agg = createBarAggregator({ interval: "1D", bucketStart: (t) => t - (t % (24 * H)) });
        const day = 24 * H;
        // Replace arm: nothing live yet. The provider's stamp is kept.
        expect(agg.seedFormingBar(bar(day + 4 * H, 10, 12, 9, 11, 100))).toBe(true);
        expect(agg.currentBar()).toEqual(bar(day + 4 * H, 10, 12, 9, 11, 100));
        expect(agg.currentBarSource()).toBe("providerSeed");
        // A second provider seed on a provider-only bucket advances close too.
        expect(agg.seedFormingBar(bar(day + 4 * H, 10, 13, 8, 12.5, 90))).toBe(true);
        expect(agg.currentBar()).toEqual(bar(day + 4 * H, 10, 13, 8, 12.5, 100));
        expect(agg.currentBarSource()).toBe("providerSeed");
        // A live tick makes it merged; a later stale provider row keeps the live close.
        agg.ingestTick(14, day + 10 * H, 5);
        expect(agg.currentBarSource()).toBe("merged");
        expect(agg.seedFormingBar(bar(day + 4 * H, 10, 12, 9, 11, 50))).toBe(true);
        expect(agg.currentBar()).toEqual(bar(day + 4 * H, 10, 14, 8, 14, 105));
        // Refuses a provider row for an older bucket.
        expect(agg.seedFormingBar(bar(4 * H, 1, 1, 1, 1))).toBe(false);
    });

    it("turns a live bucket into merged on a provider seed and unsticks a history seed", () => {
        const agg = createBarAggregator({ interval: "1h" });
        agg.ingestTick(5, M);
        expect(agg.seedFormingBar(bar(0, 4, 6, 3, 9, 50))).toBe(true);
        expect(agg.currentBar()).toEqual(bar(0, 4, 6, 3, 5, 50));
        expect(agg.currentBarSource()).toBe("merged");

        const seeded = createBarAggregator({ interval: "1h" });
        seeded.seedFromHistory([bar(0, 1, 1, 1, 1)]);
        expect(seeded.seedFormingBar(bar(0, 2, 2, 2, 2))).toBe(true);
        expect(seeded.currentBarSource()).toBe("providerSeed");
        expect(seeded.seedFormingBar(bar(H, 3, 3, 3, 3))).toBe(true);
        expect(seeded.currentBar()).toEqual(bar(H, 3, 3, 3, 3));
    });

    it("rejects non-finite samples", () => {
        const agg = createBarAggregator({ interval: "1h" });
        expect(() => agg.ingestTick(Number.NaN, 0)).toThrow(/price/);
        expect(() => agg.ingestTick(1, Number.POSITIVE_INFINITY)).toThrow(/timeMs/);
        expect(() => agg.ingestTick(1, 0, Number.NaN)).toThrow(/size/);
        expect(() => agg.ingestBar(bar(0, 1, 1, 1, Number.NaN))).toThrow(/bar field/);
        expect(() => agg.closeIfDue(Number.NaN)).toThrow(/nowMs/);
    });
});
