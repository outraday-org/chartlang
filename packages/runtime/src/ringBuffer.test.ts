// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Float64RingBuffer, RingBuffer, type RingBufferLike } from "./ringBuffer.js";

describe("RingBuffer<T>", () => {
    it("starts empty", () => {
        const buf = new RingBuffer<string>(3);
        expect(buf.length).toBe(0);
        expect(buf.capacity).toBe(3);
        expect(buf.at(0)).toBeUndefined();
        expect(buf.at(-1)).toBeUndefined();
    });

    it("appends and reads most-recent at(0)", () => {
        const buf = new RingBuffer<string>(3);
        buf.append("a");
        buf.append("b");
        buf.append("c");
        expect(buf.length).toBe(3);
        expect(buf.at(0)).toBe("c");
        expect(buf.at(1)).toBe("b");
        expect(buf.at(2)).toBe("a");
    });

    it("wraps around once capacity is exceeded", () => {
        const buf = new RingBuffer<string>(3);
        buf.append("a");
        buf.append("b");
        buf.append("c");
        buf.append("d");
        expect(buf.length).toBe(3);
        expect(buf.at(0)).toBe("d");
        expect(buf.at(1)).toBe("c");
        expect(buf.at(2)).toBe("b");
        expect(buf.at(3)).toBeUndefined();
    });

    it("replaceHead on an empty buffer behaves like append", () => {
        const buf = new RingBuffer<string>(2);
        buf.replaceHead("x");
        expect(buf.length).toBe(1);
        expect(buf.at(0)).toBe("x");
    });

    it("replaceHead overwrites the head slot in place", () => {
        const buf = new RingBuffer<string>(3);
        buf.append("a");
        buf.append("b");
        buf.replaceHead("B");
        expect(buf.length).toBe(2);
        expect(buf.at(0)).toBe("B");
        expect(buf.at(1)).toBe("a");
    });

    it("reset clears state", () => {
        const buf = new RingBuffer<string>(2);
        buf.append("a");
        buf.append("b");
        buf.reset();
        expect(buf.length).toBe(0);
        expect(buf.at(0)).toBeUndefined();
        buf.append("c");
        expect(buf.at(0)).toBe("c");
        expect(buf.length).toBe(1);
    });

    it("conforms to RingBufferLike<T>", () => {
        const ref: RingBufferLike<string> = new RingBuffer<string>(2);
        ref.append("x");
        expect(ref.at(0)).toBe("x");
        expect(ref.length).toBe(1);
        ref.reset();
        expect(ref.length).toBe(0);
    });
});

describe("Float64RingBuffer", () => {
    it("starts empty, OOR reads return NaN", () => {
        const buf = new Float64RingBuffer(3);
        expect(buf.length).toBe(0);
        expect(buf.capacity).toBe(3);
        expect(buf.at(0)).toBeNaN();
        expect(buf.at(-1)).toBeNaN();
    });

    it("appends and reads most-recent at(0)", () => {
        const buf = new Float64RingBuffer(3);
        buf.append(1);
        buf.append(2);
        buf.append(3);
        expect(buf.length).toBe(3);
        expect(buf.at(0)).toBe(3);
        expect(buf.at(1)).toBe(2);
        expect(buf.at(2)).toBe(1);
    });

    it("wraps around once capacity is exceeded", () => {
        const buf = new Float64RingBuffer(3);
        buf.append(1);
        buf.append(2);
        buf.append(3);
        buf.append(4);
        expect(buf.length).toBe(3);
        expect(buf.at(0)).toBe(4);
        expect(buf.at(2)).toBe(2);
        expect(buf.at(3)).toBeNaN();
    });

    it("replaceHead on an empty buffer behaves like append", () => {
        const buf = new Float64RingBuffer(2);
        buf.replaceHead(7);
        expect(buf.length).toBe(1);
        expect(buf.at(0)).toBe(7);
    });

    it("replaceHead overwrites the head slot in place", () => {
        const buf = new Float64RingBuffer(3);
        buf.append(1);
        buf.append(2);
        buf.replaceHead(20);
        expect(buf.length).toBe(2);
        expect(buf.at(0)).toBe(20);
        expect(buf.at(1)).toBe(1);
    });

    it("reset clears state", () => {
        const buf = new Float64RingBuffer(2);
        buf.append(1);
        buf.append(2);
        buf.reset();
        expect(buf.length).toBe(0);
        expect(buf.at(0)).toBeNaN();
        buf.append(9);
        expect(buf.at(0)).toBe(9);
    });

    it("serialises and restores private head/filled state", () => {
        const source = new Float64RingBuffer(3);
        source.append(1);
        source.append(Number.NaN);
        source.append(3);
        source.append(4);
        const snapshot = source.serialiseSnapshotBuffer();

        const restored = new Float64RingBuffer(3);
        restored.restoreFromSnapshotBuffer(snapshot);

        expect(snapshot.values).toEqual([4, null, 3]);
        expect(restored.length).toBe(3);
        expect(restored.at(0)).toBe(4);
        expect(restored.at(1)).toBe(3);
        expect(restored.at(2)).toBeNaN();
    });

    it("rejects invalid snapshot metadata", () => {
        const restored = new Float64RingBuffer(2);
        expect(() =>
            restored.restoreFromSnapshotBuffer({
                headIndex: 4,
                filled: 1,
                values: [1, 2],
            }),
        ).toThrow("invalid ring buffer snapshot");
        expect(() =>
            restored.restoreFromSnapshotBuffer({
                headIndex: 0,
                filled: 1,
                values: [1],
            }),
        ).toThrow("invalid ring buffer snapshot");
        expect(() =>
            restored.restoreFromSnapshotBuffer({
                headIndex: 0,
                filled: 0,
                values: [1, 2],
            }),
        ).toThrow("invalid ring buffer snapshot");
        expect(() =>
            restored.restoreFromSnapshotBuffer({
                headIndex: -1,
                filled: 1,
                values: [1, 2],
            }),
        ).toThrow("invalid ring buffer snapshot");
    });
});

describe("RingBuffer<T> property invariants", () => {
    it("length === min(capacity, appended count)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 32 }),
                fc.array(fc.integer(), { minLength: 0, maxLength: 200 }),
                (capacity, values) => {
                    const buf = new RingBuffer<number>(capacity);
                    for (const v of values) buf.append(v);
                    expect(buf.length).toBe(Math.min(capacity, values.length));
                },
            ),
        );
    });

    it("at(0) is the last appended value; OOR returns undefined", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 32 }),
                fc.array(fc.integer(), { minLength: 1, maxLength: 200 }),
                (capacity, values) => {
                    const buf = new RingBuffer<number>(capacity);
                    for (const v of values) buf.append(v);
                    expect(buf.at(0)).toBe(values[values.length - 1]);
                    expect(buf.at(buf.length)).toBeUndefined();
                    expect(buf.at(-1)).toBeUndefined();
                },
            ),
        );
    });

    it("at(n) reads N-back relative to the head", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                fc.array(fc.integer(), { minLength: 1, maxLength: 64 }),
                (capacity, values) => {
                    const buf = new RingBuffer<number>(capacity);
                    for (const v of values) buf.append(v);
                    for (let n = 0; n < buf.length; n += 1) {
                        expect(buf.at(n)).toBe(values[values.length - 1 - n]);
                    }
                },
            ),
        );
    });

    it("reset returns the buffer to length 0", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 16 }),
                fc.array(fc.integer(), { maxLength: 64 }),
                (capacity, values) => {
                    const buf = new RingBuffer<number>(capacity);
                    for (const v of values) buf.append(v);
                    buf.reset();
                    expect(buf.length).toBe(0);
                    expect(buf.at(0)).toBeUndefined();
                },
            ),
        );
    });
});

describe("Float64RingBuffer property invariants", () => {
    it("length === min(capacity, appended count)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 32 }),
                fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
                    maxLength: 200,
                }),
                (capacity, values) => {
                    const buf = new Float64RingBuffer(capacity);
                    for (const v of values) buf.append(v);
                    expect(buf.length).toBe(Math.min(capacity, values.length));
                },
            ),
        );
    });

    it("at(n) for n >= length returns NaN", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 16 }),
                fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
                    maxLength: 64,
                }),
                (capacity, values) => {
                    const buf = new Float64RingBuffer(capacity);
                    for (const v of values) buf.append(v);
                    expect(buf.at(buf.length)).toBeNaN();
                    expect(buf.at(-1)).toBeNaN();
                },
            ),
        );
    });

    it("at(n) reads N-back relative to the head for finite values", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                fc.array(fc.double({ noNaN: true, noDefaultInfinity: true }), {
                    minLength: 1,
                    maxLength: 64,
                }),
                (capacity, values) => {
                    const buf = new Float64RingBuffer(capacity);
                    for (const v of values) buf.append(v);
                    for (let n = 0; n < buf.length; n += 1) {
                        expect(buf.at(n)).toBe(values[values.length - 1 - n]);
                    }
                },
            ),
        );
    });
});
