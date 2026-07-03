// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { falling } from "./falling.js";

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

describe("ta.falling", () => {
    it("warmup: the first `length` bars are false, then true on a strictly decreasing series", () => {
        const bars = barsFromCloses([5, 4, 3, 2, 1]);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, true, true]);
    });

    it("a single equal step breaks the run", () => {
        const bars = barsFromCloses([5, 4, 3, 3, 1]);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, false, false]);
    });

    it("a strictly increasing series is never falling", () => {
        const bars = barsFromCloses([1, 2, 3, 4, 5]);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, false, false]);
    });

    it("a NaN anywhere in the window yields false", () => {
        const bars = barsFromCloses([6, 5, Number.NaN, 3, 2, 1]);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        expect(out).toEqual([false, false, false, false, false, false]);
    });

    it("emits a boolean (never NaN) during warmup", () => {
        const bars = barsFromCloses([2, 1]);
        const out = harness(bars, bars.length + 1, (bar) => falling("slot", bar.close, 3).current);
        for (const v of out) expect(typeof v).toBe("boolean");
    });

    it("returns the same Series identity on every call", () => {
        const bars = barsFromCloses([4, 3, 2, 1]);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(falling("slot", bar.close, 3));
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => falling("oops", 1, 3)).toThrowError(
            /ta.falling called outside an active script step/,
        );
    });
});

describe("ta.falling tick-mode", () => {
    it("a lower tick head keeps the run falling", () => {
        const bars = barsFromCloses([4, 3, 2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            falling("slot", bar.close, 3),
        );
        const tickClose = 0.5;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => falling("slot", tickClose, 3).current,
        );
        expect(head).toBe(true);
    });

    it("a higher tick head breaks the run", () => {
        const bars = barsFromCloses([4, 3, 2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            falling("slot", bar.close, 3),
        );
        const tickClose = 2.5;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => falling("slot", tickClose, 3).current,
        );
        expect(head).toBe(false);
    });

    it("tick during warmup returns false", () => {
        const bars = barsFromCloses([2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            falling("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[1], () => falling("slot", bars[1].close, 5).current);
        expect(head).toBe(false);
    });

    it("tick with a NaN source returns false", () => {
        const bars = barsFromCloses([4, 3, 2, 1]);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            falling("slot", bar.close, 3),
        );
        const head = tick(
            ctxRef,
            bars[bars.length - 1],
            () => falling("slot", Number.NaN, 3).current,
        );
        expect(head).toBe(false);
    });
});
