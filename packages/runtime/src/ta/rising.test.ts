// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { rising } from "./rising.js";

function barsFromCloses(closes: ReadonlyArray<number>): Bar[] {
    return closes.map((c, i) => ({
        time: 1_700_000_000_000 + i * 60_000,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 0,
        symbol: "T",
        interval: "1m",
    }));
}

describe("ta.rising", () => {
    it("warmup: the first `length` bars are false, then true on a strictly increasing series", () => {
        const bars = barsFromCloses([1, 2, 3, 4, 5]);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, true, true]);
    });

    it("a single equal step breaks the run", () => {
        const bars = barsFromCloses([1, 2, 3, 3, 5]);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        // bar 3 window [1,2,3,3] has a 0-delta; bar 4 window [2,3,3,5] too.
        expect(out).toEqual([false, false, false, false, false]);
    });

    it("a strictly decreasing series is never rising", () => {
        const bars = barsFromCloses([5, 4, 3, 2, 1]);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, false, false]);
    });

    it("a NaN anywhere in the window yields false", () => {
        const bars = barsFromCloses([1, 2, Number.NaN, 4, 5, 6]);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        // Windows for bars 3,4,5: [1,2,NaN,4], [2,NaN,4,5], [NaN,4,5,6] — all
        // contain the NaN, so all false.
        expect(out).toEqual([false, false, false, false, false, false]);
    });

    it("emits a boolean (never NaN) during warmup", () => {
        const bars = barsFromCloses([1, 2]);
        const out = harness(bars, bars.length + 1, (bar) => rising("slot", bar.close, 3).current);
        for (const v of out) expect(typeof v).toBe("boolean");
    });

    it("returns the same Series identity on every call", () => {
        const bars = barsFromCloses([1, 2, 3, 4]);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(rising("slot", bar.close, 3));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => rising("oops", 1, 3)).toThrowError(
            /ta.rising called outside an active script step/,
        );
    });
});

describe("ta.rising tick-mode", () => {
    it("a higher tick head keeps the run rising", () => {
        const bars = barsFromCloses([1, 2, 3, 4]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rising("slot", bar.close, 3),
        );
        const tickClose = 5;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => rising("slot", tickClose, 3).current,
        );
        expect(head).toBe(true);
    });

    it("a lower tick head breaks the run", () => {
        const bars = barsFromCloses([1, 2, 3, 4]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rising("slot", bar.close, 3),
        );
        const tickClose = 2.5;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => rising("slot", tickClose, 3).current,
        );
        expect(head).toBe(false);
    });

    it("tick during warmup returns false", () => {
        const bars = barsFromCloses([1, 2]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            rising("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[1], () => rising("slot", bars[1].close, 5).current);
        expect(head).toBe(false);
    });

    it("tick with a NaN source returns false", () => {
        const bars = barsFromCloses([1, 2, 3, 4]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            rising("slot", bar.close, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => rising("slot", Number.NaN, 3).current,
        );
        expect(head).toBe(false);
    });
});
