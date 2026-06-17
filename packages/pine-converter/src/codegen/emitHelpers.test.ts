// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { emitHandleRingHelper } from "./emitHelpers.js";

// A minimal stand-in for a core `DrawingHandle`: only `remove()` is exercised
// by the ring's eviction path. Each handle carries an id so the test can
// assert which element `at()` returns in logical (FIFO) order.
type FakeHandle = { id: number; remove(): void };

function fakeHandle(id: number): FakeHandle {
    return { id, remove: () => {} };
}

// Transpile the emitted helper lines to runnable JS (stripping the type
// annotations + `DrawingHandle` type that only exist at the chartlang-source
// level) and return the `useDrawingHandleRing(cap)` factory. The emitted
// source declares the type + function; we append a `return` of the factory so
// `transpileModule`'s output, eval'd, hands it back.
function loadRingFactory(): (cap: number) => {
    push(h: FakeHandle | null): void;
    at(i: number): FakeHandle | null;
    size(): number;
} {
    const helperSource = emitHandleRingHelper().join("\n");
    const wrapped = `${helperSource}\nreturn useDrawingHandleRing;`;
    const js = ts.transpileModule(wrapped, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    // `new Function` evaluates the helper body and returns the factory.
    return new Function(js)();
}

describe("emitHandleRingHelper — at() honours __head after wrap", () => {
    it("returns physical-order elements before the buffer fills", () => {
        const ring = loadRingFactory()(3);
        ring.push(fakeHandle(0));
        ring.push(fakeHandle(1));
        expect(ring.size()).toBe(2);
        expect(ring.at(0)?.id).toBe(0);
        expect(ring.at(1)?.id).toBe(1);
        // Past the live count → null.
        expect(ring.at(2)).toBeNull();
    });

    it("returns oldest→newest logical order after the ring wraps", () => {
        const ring = loadRingFactory()(3);
        // Push 5 handles into a cap-3 ring: 0 and 1 are evicted, leaving the
        // logical FIFO order [2, 3, 4].
        for (let id = 0; id < 5; id += 1) {
            ring.push(fakeHandle(id));
        }
        expect(ring.size()).toBe(3);
        // array.first → at(0) must be the OLDEST live element (2), not the
        // physical slot 0 (which now holds 3 after the wrap).
        expect(ring.at(0)?.id).toBe(2);
        expect(ring.at(1)?.id).toBe(3);
        // array.last → at(size - 1) must be the NEWEST element (4).
        expect(ring.at(ring.size() - 1)?.id).toBe(4);
    });

    it("evicts the oldest handle (calls remove) when full", () => {
        const ring = loadRingFactory()(2);
        const removed: number[] = [];
        const handleWithSpy = (id: number): FakeHandle => ({
            id,
            remove: () => removed.push(id),
        });
        ring.push(handleWithSpy(0));
        ring.push(handleWithSpy(1));
        ring.push(handleWithSpy(2)); // evicts 0
        ring.push(handleWithSpy(3)); // evicts 1
        expect(removed).toEqual([0, 1]);
        expect(ring.at(0)?.id).toBe(2);
        expect(ring.at(1)?.id).toBe(3);
    });

    it("tolerates a null push without removing", () => {
        const ring = loadRingFactory()(1);
        ring.push(fakeHandle(0));
        ring.push(null); // evicts handle 0, stores null
        expect(ring.at(0)).toBeNull();
        expect(ring.size()).toBe(1);
    });
});
