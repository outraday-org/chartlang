// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { ema } from "./ema.js";
import { computeEmaOfFloat64 } from "./lib/emaFloat64.js";

describe("ta.ema", () => {
    it("matches computeEmaOfFloat64 over a 50-bar synthetic walk", () => {
        const bars = syntheticBars(50, 7);
        const closes = new Float64Array(bars.map((b) => b.close));
        const expected = computeEmaOfFloat64(closes, 10);
        const actual = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 10).current);
        for (let i = 0; i < bars.length; i += 1) {
            const a = actual[i];
            const e = expected[i];
            if (Number.isNaN(e)) expect(Number.isNaN(a)).toBe(true);
            else expect(a).toBeCloseTo(e, 10);
        }
    });

    it("is finite from bar zero for a finite source", () => {
        const bars = syntheticBars(30, 3);
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        expect(out[0]).toBe(bars[0].close);
        expect(out.every(Number.isFinite)).toBe(true);
    });

    it("returns the same Series identity on every call", () => {
        const bars = syntheticBars(10, 1);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            const s = ema("slot", bar.close, 3);
            identities.add(s);
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("throws when called outside an active script step", () => {
        expect(() => ema("oops", 1, 3)).toThrowError(/ta.ema called outside an active script step/);
    });

    it("accepts a Series source via .current", () => {
        const bars = syntheticBars(20, 4);
        // Pass the runtime's close-series view instead of the scalar.
        const out = harness(
            bars,
            bars.length + 1,
            (_bar, ctx) => ema("slot", ctx.stream.seriesViews.close, 5).current,
        );
        expect(Number.isFinite(out[bars.length - 1])).toBe(true);
    });

    it("emits NaN for a missing source and resumes from the prior finite EMA", () => {
        const bars: Bar[] = syntheticBars(20, 4).map((b, i) =>
            i === 10 ? { ...b, close: Number.NaN } : b,
        );
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        expect(Number.isNaN(out[10])).toBe(true);
        const alpha = 2 / 6;
        expect(out[11]).toBeCloseTo(bars[11].close * alpha + out[9] * (1 - alpha), 12);
    });

    it("keeps leading NaNs and seeds on the first usable source", () => {
        const bars: Bar[] = syntheticBars(5, 8).map((bar, index) =>
            index < 2 ? { ...bar, close: Number.NaN } : bar,
        );
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 5).current);
        expect(Number.isNaN(out[0])).toBe(true);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(bars[2].close);
    });

    it("length 1 follows each finite source exactly and preserves NaN gaps", () => {
        const bars: Bar[] = syntheticBars(4, 2).map((bar, index) =>
            index === 1 ? { ...bar, close: Number.NaN } : bar,
        );
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, 1).current);
        expect(out[0]).toBe(bars[0].close);
        expect(Number.isNaN(out[1])).toBe(true);
        expect(out[2]).toBe(bars[2].close);
        expect(out[3]).toBe(bars[3].close);
    });

    it.each([0, -1, 1.5, Number.NaN])("emits NaN for invalid length %s", (length) => {
        const bars = syntheticBars(4, 2);
        const out = harness(bars, bars.length + 1, (bar) => ema("slot", bar.close, length).current);
        expect(out.every(Number.isNaN)).toBe(true);
    });

    it("exposes the first finite output through history indexing", () => {
        const bars = syntheticBars(4, 9);
        const out = harness(bars, bars.length + 1, (bar) => {
            const series = ema("slot", bar.close, 5);
            return { current: series.current, prior: series[1] };
        });
        expect(out[0].current).toBe(bars[0].close);
        expect(Number.isNaN(out[0].prior)).toBe(true);
        expect(out[1].prior).toBe(out[0].current);
    });
});

describe("ta.ema first-usable tick", () => {
    it("a finite tick replaces a NaN closed head from the prior recurrence", () => {
        const bars: Bar[] = syntheticBars(2, 6);
        bars[1] = { ...bars[1], close: Number.NaN };
        const { ctxRef } = harnessWithCtx(bars, bars.length + 10, (bar) =>
            ema("slot", bar.close, 5),
        );
        const tickClose = 200;
        const head = tick(
            ctxRef,
            { ...bars[bars.length - 1], close: tickClose },
            () => ema("slot", tickClose, 5).current,
        );
        const alpha = 2 / 6;
        const expected = tickClose * alpha + bars[0].close * (1 - alpha);
        expect(head).toBeCloseTo(expected, 10);
    });

    it("a finite tick seeds immediately when no finite close exists", () => {
        const bars: Bar[] = syntheticBars(2, 7).map((bar) => ({
            ...bar,
            close: Number.NaN,
        }));
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            ema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => ema("slot", 123, 5).current);
        expect(head).toBe(123);
    });

    it("a NaN tick emits NaN without changing recurrence state", () => {
        const bars = syntheticBars(2, 7);
        const { ctxRef } = harnessWithCtx(bars, bars.length + 5, (bar) =>
            ema("slot", bar.close, 5),
        );
        const head = tick(ctxRef, bars[bars.length - 1], () => ema("slot", Number.NaN, 5).current);
        expect(Number.isNaN(head)).toBe(true);
    });
});

describe("ta.ema tick-mode", () => {
    it("replaces the head value without advancing length", () => {
        const bars = syntheticBars(10, 2);
        const length = 3;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ema("slot", bar.close, length),
        );
        const lengthBefore = ctxRef.ctx.stream.ohlcv.close.length;
        const headBefore = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        const tickBar: Bar = { ...bars[bars.length - 1], close: bars[bars.length - 1].close + 5 };
        tick(ctxRef, tickBar, () => ema("slot", tickBar.close, length));
        const lengthAfter = ctxRef.ctx.stream.ohlcv.close.length;
        const headAfter = (
            ctxRef.ctx.stream.taSlots.get("slot") as {
                series: { current: number };
            }
        ).series.current;
        expect(lengthAfter).toBe(lengthBefore);
        expect(headAfter).not.toBe(headBefore);
    });

    it("two identical ticks compute the same head (don't compound)", () => {
        const bars = syntheticBars(20, 9);
        const length = 5;
        const { ctxRef } = harnessWithCtx(bars, bars.length + 1, (bar) =>
            ema("slot", bar.close, length),
        );
        const tickClose = bars[bars.length - 1].close + 10;
        const tickBar: Bar = { ...bars[bars.length - 1], close: tickClose };
        let a = 0;
        let b = 0;
        tick(ctxRef, tickBar, () => {
            a = ema("slot", tickBar.close, length).current;
            return a;
        });
        tick(ctxRef, tickBar, () => {
            b = ema("slot", tickBar.close, length).current;
            return b;
        });
        expect(b).toBeCloseTo(a, 12);
    });

    it("does not carry a tentative tick into the next close", () => {
        const bars: Bar[] = [
            { ...syntheticBars(1, 1)[0], close: 10 },
            { ...syntheticBars(1, 2)[0], close: 20 },
        ];
        const { ctxRef } = harnessWithCtx(bars, 8, (bar) => ema("slot", bar.close, 3));
        const tickBar = { ...bars[1], close: 100 };
        const tentative = tick(ctxRef, tickBar, () => ema("slot", tickBar.close, 3).current);
        expect(tentative).toBe(55);

        ACTIVE_RUNTIME_CONTEXT.current = ctxRef.ctx;
        try {
            ctxRef.ctx.isTick = false;
            const nextClose = ema("slot", 30, 3).current;
            expect(nextClose).toBe(22.5);
        } finally {
            ACTIVE_RUNTIME_CONTEXT.current = null;
        }
    });
});

describe("ta.ema — opts.offset", () => {
    it("offset === 0 returns the same Series identity as no opts", () => {
        const bars = syntheticBars(20, 7);
        const identities = new Set<unknown>();
        let toggle = false;
        harness(bars, bars.length + 1, (bar) => {
            toggle = !toggle;
            identities.add(
                toggle ? ema("slot", bar.close, 5) : ema("slot", bar.close, 5, { offset: 0 }),
            );
            return null;
        });
        expect(identities.size).toBe(1);
    });

    it("offset === k > 0 leaves .current unshifted (offset is presentation-only)", () => {
        const bars = syntheticBars(30, 11);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5).current,
        );
        const shifted = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5, { offset: 3 }).current,
        );
        for (let i = 0; i < bars.length; i += 1) {
            const u = unshifted[i];
            const s = shifted[i];
            if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
            else expect(s).toBeCloseTo(u, 12);
        }
    });

    it("offset === -k leaves .current unshifted (no future read; presentation-only)", () => {
        const bars = syntheticBars(20, 1);
        const unshifted = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5).current,
        );
        const head = harness(
            bars,
            bars.length + 1,
            (bar) => ema("slot", bar.close, 5, { offset: -2 }).current,
        );
        expect(head[head.length - 1]).toBeCloseTo(unshifted[unshifted.length - 1], 12);
        expect(Number.isNaN(head[head.length - 1])).toBe(false);
    });

    it("two calls with the same non-zero offset return the same Series identity", () => {
        const bars = syntheticBars(10, 3);
        const identities = new Set<unknown>();
        harness(bars, bars.length + 1, (bar) => {
            identities.add(ema("slot", bar.close, 5, { offset: 2 }));
            return null;
        });
        expect(identities.size).toBe(1);
    });
});
