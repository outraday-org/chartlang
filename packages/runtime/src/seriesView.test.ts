// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Float64RingBuffer, RingBuffer } from "./ringBuffer.js";
import { makeSeriesView, makeShiftedSeriesView } from "./seriesView.js";

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

describe("makeShiftedSeriesView", () => {
    it("offset === 0 delegates to makeSeriesView", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeShiftedSeriesView<number>(buf, 0);
        buf.append(1);
        buf.append(2);
        expect(view.current).toBe(2);
        expect(view[0]).toBe(2);
        expect(view[1]).toBe(1);
        expect(view.length).toBe(2);
    });

    it("positive offset shifts the read window into the past", () => {
        const buf = new Float64RingBuffer(8);
        buf.append(10);
        buf.append(20);
        buf.append(30);
        const view = makeShiftedSeriesView<number>(buf, 1);
        expect(view.current).toBe(20);
        expect(view[0]).toBe(20);
        expect(view[1]).toBe(10);
        expect(view[2]).toBeNaN();
        expect(view.length).toBe(3);
    });

    it("negative offset returns NaN at the head (future read)", () => {
        const buf = new Float64RingBuffer(8);
        buf.append(10);
        buf.append(20);
        buf.append(30);
        const view = makeShiftedSeriesView<number>(buf, -1);
        expect(view.current).toBeNaN();
        expect(view[0]).toBeNaN();
        expect(view[1]).toBe(30);
        expect(view[2]).toBe(20);
    });

    it("offset exceeding buffer length returns all NaN", () => {
        const buf = new Float64RingBuffer(4);
        buf.append(1);
        buf.append(2);
        const view = makeShiftedSeriesView<number>(buf, 10);
        expect(view.current).toBeNaN();
        expect(view[0]).toBeNaN();
        expect(view[1]).toBeNaN();
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

    it("object-backed buffer returns undefined on OOR shifted reads", () => {
        const buf = new RingBuffer<{ x: number }>(3);
        buf.append({ x: 1 });
        buf.append({ x: 2 });
        const view = makeShiftedSeriesView<{ x: number }>(buf, 1);
        expect(view.current).toEqual({ x: 1 });
        expect(view[1]).toBeUndefined();
        const futureView = makeShiftedSeriesView<{ x: number }>(buf, -1);
        expect(futureView.current).toBeUndefined();
    });

    it("identity is stable across appends", () => {
        const buf = new Float64RingBuffer(4);
        const view = makeShiftedSeriesView<number>(buf, 2);
        const ref = view;
        for (let i = 0; i < 16; i += 1) buf.append(i);
        expect(view).toBe(ref);
    });

    it("shifted_k.at(n) === unshifted.at(n + k) for every defined index", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 16 }),
                fc.integer({ min: 1, max: 5 }),
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
                        const u = unshifted[n + offset];
                        const s = shifted[n];
                        if (Number.isNaN(u)) expect(Number.isNaN(s)).toBe(true);
                        else expect(s).toBe(u);
                    }
                },
            ),
        );
    });
});
