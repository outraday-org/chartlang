// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Float64RingBuffer, RingBuffer } from "./ringBuffer.js";
import { makeSeriesView, makeShiftedSeriesView, seriesOffsetOf } from "./seriesView.js";

describe("makeSeriesView (Float64 backing)", () => {
    it("series.current === buf.at(0)", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        expect(view.current).toBeNaN();
        buf.append(1);
        buf.append(2);
        expect(view.current).toBe(2);
        expect(view[0]).toBe(2);
        expect(view[0]).toBe(view.current);
    });

    it("series.length reflects the buffer through the Proxy", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        expect(view.length).toBe(0);
        buf.append(1);
        expect(view.length).toBe(1);
        buf.append(2);
        buf.append(3);
        expect(view.length).toBe(3);
    });

    it("series[n] for n beyond length returns NaN", () => {
        const buf = new Float64RingBuffer(3);
        buf.append(1);
        const view = makeSeriesView<number>(buf);
        expect(view[1000]).toBeNaN();
        expect(view[1]).toBeNaN();
    });

    it("unknown keys return undefined", () => {
        const buf = new Float64RingBuffer(3);
        const view = makeSeriesView<number>(buf);
        const probe = view as unknown as Record<string | symbol, unknown>;
        expect(probe.foo).toBeUndefined();
        expect(probe[Symbol.iterator]).toBeUndefined();
        expect(probe["3.5"]).toBeUndefined();
        expect(probe["-1"]).toBeUndefined();
    });

    it("identity is stable across appends", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        const ref = view;
        for (let i = 0; i < 16; i += 1) buf.append(i);
        expect(view).toBe(ref);
    });

    it("supports the `in` operator for `current`, `length`, and non-negative integer indices", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        expect("current" in view).toBe(true);
        expect("length" in view).toBe(true);
        expect("0" in view).toBe(true);
        expect("5" in view).toBe(true);
    });

    it("returns false from `in` for unknown string keys, fractional keys, negative keys, and symbol keys", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        expect("foo" in view).toBe(false);
        expect("3.5" in view).toBe(false);
        expect("-1" in view).toBe(false);
        const probe = view as unknown as Record<symbol, unknown>;
        expect(Symbol.iterator in probe).toBe(false);
    });

    it("coerces to its current value (buf.at(0)) in numeric and string contexts", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        buf.append(10);
        buf.append(20);
        // valueOf drives arithmetic / comparison / Math.* coercion.
        expect(view * 2).toBe(40);
        expect(view + 1).toBe(21);
        expect(view > 15).toBe(true);
        expect(Math.max(view as unknown as number, 5)).toBe(20);
        expect(Number(view)).toBe(20);
        expect(+view).toBe(20);
        // Symbol.toPrimitive drives string coercion (template literals).
        expect(`${view}`).toBe("20");
        // The view stays indexable alongside coercion.
        expect(view[1]).toBe(10);
        expect(view.current).toBe(20);
    });

    it("exposes valueOf / Symbol.toPrimitive as functions and via `in`", () => {
        const buf = new Float64RingBuffer(4);
        buf.append(7);
        const view = makeSeriesView<number>(buf);
        const probe = view as unknown as {
            valueOf: () => number;
            [Symbol.toPrimitive]: (hint: string) => number;
        };
        expect(typeof probe.valueOf).toBe("function");
        expect(probe.valueOf()).toBe(7);
        expect(typeof probe[Symbol.toPrimitive]).toBe("function");
        expect(probe[Symbol.toPrimitive]("number")).toBe(7);
        expect("valueOf" in view).toBe(true);
        expect(Symbol.toPrimitive in (view as unknown as Record<symbol, unknown>)).toBe(true);
    });

    it("coerces NaN before any bar lands", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeSeriesView<number>(buf);
        expect(Number.isNaN(+view)).toBe(true);
    });
});

describe("makeSeriesView (object backing)", () => {
    it("returns undefined on OOR reads", () => {
        const buf = new RingBuffer<{ x: number }>(3);
        const view = makeSeriesView<{ x: number }>(buf);
        expect(view.current).toBeUndefined();
        buf.append({ x: 1 });
        expect(view.current).toEqual({ x: 1 });
        expect(view[5]).toBeUndefined();
    });
});

describe("makeSeriesView property invariants", () => {
    it("series[n] matches buf.at(n) for non-negative integer indices", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
                    minLength: 1,
                    maxLength: 64,
                }),
                (capacity, values) => {
                    const buf = new Float64RingBuffer(capacity);
                    const view = makeSeriesView<number>(buf);
                    for (const v of values) buf.append(v);
                    for (let n = 0; n < buf.length; n += 1) {
                        expect(view[n]).toBe(buf.at(n));
                    }
                    expect(view.length).toBe(buf.length);
                    expect(view.current).toBe(buf.at(0));
                },
            ),
        );
    });
});

describe("makeShiftedSeriesView (presentation tag, Option A)", () => {
    it("offset === 0 returns an unshifted, untagged view", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeShiftedSeriesView<number>(buf, 0);
        buf.append(1);
        buf.append(2);
        expect(view.current).toBe(2);
        expect(view[0]).toBe(2);
        expect(view[1]).toBe(1);
        expect(view.length).toBe(2);
        expect(seriesOffsetOf(view)).toBe(0);
    });

    it("positive offset leaves the value unshifted and records the offset", () => {
        const buf = new Float64RingBuffer(8);
        buf.append(10);
        buf.append(20);
        buf.append(30);
        const view = makeShiftedSeriesView<number>(buf, 3);
        // The offset is presentation-only — the read window is NOT shifted.
        expect(view.current).toBe(30);
        expect(view[0]).toBe(30);
        expect(view[1]).toBe(20);
        expect(view[2]).toBe(10);
        expect(view.length).toBe(3);
        expect(seriesOffsetOf(view)).toBe(3);
    });

    it("negative offset leaves the value unshifted and records the offset", () => {
        const buf = new Float64RingBuffer(8);
        buf.append(10);
        buf.append(20);
        buf.append(30);
        const view = makeShiftedSeriesView<number>(buf, -2);
        // No future read: the head is the real current value.
        expect(view.current).toBe(30);
        expect(view[0]).toBe(30);
        expect(view[1]).toBe(20);
        expect(seriesOffsetOf(view)).toBe(-2);
    });

    it("seriesOffsetOf returns 0 for a plain makeSeriesView view", () => {
        const buf = new Float64RingBuffer(4);
        expect(seriesOffsetOf(makeSeriesView<number>(buf))).toBe(0);
    });

    it("unknown keys return undefined", () => {
        const buf = new Float64RingBuffer(3);
        const view = makeShiftedSeriesView<number>(buf, 2);
        const probe = view as unknown as Record<string | symbol, unknown>;
        expect(probe.foo).toBeUndefined();
        expect(probe[Symbol.iterator]).toBeUndefined();
        expect(probe["3.5"]).toBeUndefined();
        expect(probe["-1"]).toBeUndefined();
    });

    it("supports the `in` operator for `current`, `length`, and non-negative integer indices", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeShiftedSeriesView<number>(buf, 1);
        expect("current" in view).toBe(true);
        expect("length" in view).toBe(true);
        expect("0" in view).toBe(true);
        expect("5" in view).toBe(true);
        expect("foo" in view).toBe(false);
        expect("3.5" in view).toBe(false);
        expect("-1" in view).toBe(false);
        const probe = view as unknown as Record<symbol, unknown>;
        expect(Symbol.iterator in probe).toBe(false);
    });

    it("object-backed buffer reads are unshifted and the offset is recorded", () => {
        const buf = new RingBuffer<{ x: number }>(3);
        buf.append({ x: 1 });
        buf.append({ x: 2 });
        const view = makeShiftedSeriesView<{ x: number }>(buf, 1);
        expect(view.current).toEqual({ x: 2 });
        expect(view[1]).toEqual({ x: 1 });
        expect(seriesOffsetOf(view)).toBe(1);
    });

    it("identity is stable across appends", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeShiftedSeriesView<number>(buf, 2);
        const ref = view;
        for (let i = 0; i < 16; i += 1) buf.append(i);
        expect(view).toBe(ref);
        expect(seriesOffsetOf(view)).toBe(2);
    });

    it("the tagged view equals the unshifted view at every index; the tag round-trips", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 16 }),
                fc.integer({ min: -5, max: 5 }).filter((o) => o !== 0),
                fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
                    minLength: 1,
                    maxLength: 64,
                }),
                (capacity, offset, values) => {
                    const buf = new Float64RingBuffer(capacity);
                    for (const v of values) buf.append(v);
                    const unshifted = makeSeriesView<number>(buf);
                    const shifted = makeShiftedSeriesView<number>(buf, offset);
                    for (let n = 0; n < buf.length; n += 1) {
                        expect(shifted[n]).toBe(unshifted[n]);
                    }
                    expect(shifted.current).toBe(unshifted.current);
                    expect(shifted.length).toBe(unshifted.length);
                    expect(seriesOffsetOf(shifted)).toBe(offset);
                },
            ),
        );
    });
});
