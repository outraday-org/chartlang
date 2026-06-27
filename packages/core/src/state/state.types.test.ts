// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type {
    BoolSeriesSlot,
    Color,
    NumberSeriesSlot,
    Series,
    StringSeriesSlot,
} from "../types.js";
import type { MutableArraySlot } from "./arraySlot.js";
import type { MutableMapSlot } from "./mapSlot.js";
import type { MutableSlot } from "./mutableSlot.js";
import type { StateNamespace } from "./state.js";

function slot<T>(initial: T): MutableSlot<T> {
    let current = initial;
    return {
        get value() {
            return current;
        },
        set value(next: T) {
            current = next;
        },
    };
}

function seriesSlot<T>(initial: T): MutableSlot<T> & Series<T> {
    let current = initial;
    return {
        get value() {
            return current;
        },
        set value(next: T) {
            current = next;
        },
        get current() {
            return current;
        },
        get length() {
            return 1;
        },
        [0]: current,
    };
}

function arraySlot<T>(capacity: number): MutableArraySlot<T> {
    const buf: T[] = [];
    return {
        push: (v) => void buf.push(v),
        get: (n) => buf[buf.length - 1 - n],
        last: () => buf[buf.length - 1],
        clear: () => {
            buf.length = 0;
        },
        get size() {
            return buf.length;
        },
        get capacity() {
            return capacity;
        },
        sum: () => 0,
        avg: () => 0,
        min: () => 0,
        max: () => 0,
        range: () => 0,
        variance: () => 0,
        stdev: () => 0,
        median: () => 0,
        percentile: () => 0,
        indexOf: () => -1,
        includes: () => false,
        sort: () => [],
    };
}

function mapSlot<K extends string | number, V>(): MutableMapSlot<K, V> {
    const m = new Map<K, V>();
    return {
        set: (k, v) => void m.set(k, v),
        get: (k) => m.get(k),
        has: (k) => m.has(k),
        delete: (k) => m.delete(k),
        clear: () => m.clear(),
        get size() {
            return m.size;
        },
        keyAt: () => undefined,
    };
}

const runtimeState: StateNamespace = {
    float: (init) => slot(init),
    int: (init) => slot(init),
    bool: (init) => slot(init),
    string: (init) => slot(init),
    series: (init) => seriesSlot(init),
    color: (init) => slot(init),
    boolSeries: (init) => seriesSlot(init),
    stringSeries: (init) => seriesSlot(init),
    array: (capacity) => arraySlot(capacity),
    map: () => mapSlot(),
    tick: {
        float: (init) => slot(init),
        int: (init) => slot(init),
        bool: (init) => slot(init),
        string: (init) => slot(init),
    },
};

describe("state namespace type surface", () => {
    it("returns typed mutable slots for state.* builders", () => {
        expectTypeOf(runtimeState.float(0)).toEqualTypeOf<MutableSlot<number>>();
        expectTypeOf(runtimeState.int(0)).toEqualTypeOf<MutableSlot<number>>();
        expectTypeOf(runtimeState.bool(true)).toEqualTypeOf<MutableSlot<boolean>>();
        expectTypeOf(runtimeState.string("x")).toEqualTypeOf<MutableSlot<string>>();
    });

    it("returns typed mutable slots for state.tick.* builders", () => {
        expectTypeOf(runtimeState.tick.float(0)).toEqualTypeOf<MutableSlot<number>>();
        expectTypeOf(runtimeState.tick.int(0)).toEqualTypeOf<MutableSlot<number>>();
        expectTypeOf(runtimeState.tick.bool(true)).toEqualTypeOf<MutableSlot<boolean>>();
        expectTypeOf(runtimeState.tick.string("x")).toEqualTypeOf<MutableSlot<string>>();
    });

    it("state.series is both a writable scalar slot and an indexable series", () => {
        const s = runtimeState.series(0);
        expectTypeOf(s).toEqualTypeOf<NumberSeriesSlot>();
        // dual nature — assignable to BOTH halves of the intersection
        expectTypeOf(s).toMatchTypeOf<MutableSlot<number>>();
        expectTypeOf(s).toMatchTypeOf<Series<number>>();
        // series reads resolve to number
        expectTypeOf(s[1]).toEqualTypeOf<number>();
        expectTypeOf(s.current).toEqualTypeOf<number>();
        expectTypeOf(s.length).toEqualTypeOf<number>();
        // writable scalar — `.value` is a readable + assignable number
        expectTypeOf(s.value).toEqualTypeOf<number>();
        s.value = 1;
    });

    it("state.color is a writable color scalar slot", () => {
        const c = runtimeState.color("#000000");
        expectTypeOf(c).toEqualTypeOf<MutableSlot<Color>>();
        expectTypeOf(c.value).toEqualTypeOf<Color>();
        c.value = "#ff0000";
    });

    it("state.boolSeries is a writable scalar slot and an indexable boolean series", () => {
        const s = runtimeState.boolSeries(false);
        expectTypeOf(s).toEqualTypeOf<BoolSeriesSlot>();
        expectTypeOf(s).toMatchTypeOf<MutableSlot<boolean>>();
        expectTypeOf(s).toMatchTypeOf<Series<boolean>>();
        expectTypeOf(s[1]).toEqualTypeOf<boolean>();
        expectTypeOf(s.current).toEqualTypeOf<boolean>();
        expectTypeOf(s.value).toEqualTypeOf<boolean>();
        s.value = true;
    });

    it("state.stringSeries is a writable scalar slot and an indexable string series", () => {
        const s = runtimeState.stringSeries("");
        expectTypeOf(s).toEqualTypeOf<StringSeriesSlot>();
        expectTypeOf(s).toMatchTypeOf<MutableSlot<string>>();
        expectTypeOf(s).toMatchTypeOf<Series<string>>();
        expectTypeOf(s[2]).toEqualTypeOf<string>();
        expectTypeOf(s.current).toEqualTypeOf<string>();
        expectTypeOf(s.value).toEqualTypeOf<string>();
        s.value = "x";
    });
});
