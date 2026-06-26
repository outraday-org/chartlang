// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { MutableArraySlot } from "../state/arraySlot.js";
import { array } from "./index.js";

// A delegation-tracking stand-in for the handle the runtime installs (never
// the real `state.array(...)` hole, which throws, and never the task-2
// reduction bodies). Each reduction returns a distinct sentinel and records
// the arguments it was called with, so the wrapper can be proven to forward
// both the call AND its arguments 1:1.
type Call = { method: string; args: ReadonlyArray<unknown> };

function trackingSlot(): { slot: MutableArraySlot<number>; calls: Call[] } {
    const calls: Call[] = [];
    const record =
        <R>(method: string, result: R) =>
        (...args: unknown[]): R => {
            calls.push({ method, args });
            return result;
        };
    const slot: MutableArraySlot<number> = {
        push: record("push", undefined),
        get: record("get", 0),
        last: record("last", 0),
        clear: record("clear", undefined),
        size: 0,
        capacity: 8,
        sum: record("sum", 1),
        avg: record("avg", 2),
        min: record("min", 3),
        max: record("max", 4),
        range: record("range", 5),
        variance: record("variance", 6),
        stdev: record("stdev", 7),
        median: record("median", 8),
        percentile: record("percentile", 9),
        indexOf: record("indexOf", 10),
        includes: record("includes", true),
        sort: record("sort", [1, 2, 3]),
    };
    return { slot, calls };
}

describe("array namespace", () => {
    it("exposes exactly the twelve documented members and is frozen", () => {
        expect(Object.keys(array).sort()).toEqual(
            [
                "avg",
                "includes",
                "indexOf",
                "max",
                "median",
                "min",
                "percentile",
                "range",
                "sort",
                "stdev",
                "sum",
                "variance",
            ].sort(),
        );
        expect(Object.isFrozen(array)).toBe(true);
    });

    it("delegates the no-argument reductions to the handle method of the same name", () => {
        const { slot, calls } = trackingSlot();
        expect(array.sum(slot)).toBe(1);
        expect(array.avg(slot)).toBe(2);
        expect(array.min(slot)).toBe(3);
        expect(array.max(slot)).toBe(4);
        expect(array.range(slot)).toBe(5);
        expect(array.median(slot)).toBe(8);
        expect(calls.map((c) => c.method)).toEqual(["sum", "avg", "min", "max", "range", "median"]);
        for (const c of calls) expect(c.args).toEqual([]);
    });

    it("forwards the optional `biased` flag to variance / stdev", () => {
        const { slot, calls } = trackingSlot();
        expect(array.variance(slot)).toBe(6);
        expect(array.variance(slot, false)).toBe(6);
        expect(array.stdev(slot)).toBe(7);
        expect(array.stdev(slot, false)).toBe(7);
        expect(calls).toEqual([
            { method: "variance", args: [undefined] },
            { method: "variance", args: [false] },
            { method: "stdev", args: [undefined] },
            { method: "stdev", args: [false] },
        ]);
    });

    it("forwards the scalar arguments to percentile / indexOf / includes", () => {
        const { slot, calls } = trackingSlot();
        expect(array.percentile(slot, 90)).toBe(9);
        expect(array.indexOf(slot, 42)).toBe(10);
        expect(array.includes(slot, 7)).toBe(true);
        expect(calls).toEqual([
            { method: "percentile", args: [90] },
            { method: "indexOf", args: [42] },
            { method: "includes", args: [7] },
        ]);
    });

    it("forwards the optional sort order and returns the handle's copy", () => {
        const { slot, calls } = trackingSlot();
        expect(array.sort(slot)).toEqual([1, 2, 3]);
        expect(array.sort(slot, "desc")).toEqual([1, 2, 3]);
        expect(calls).toEqual([
            { method: "sort", args: [undefined] },
            { method: "sort", args: ["desc"] },
        ]);
    });
});
