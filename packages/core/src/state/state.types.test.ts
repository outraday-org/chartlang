// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { NumberSeriesSlot, Series } from "../types.js";
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

function seriesSlot(initial: number): NumberSeriesSlot {
    let current = initial;
    return {
        get value() {
            return current;
        },
        set value(next: number) {
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

const runtimeState: StateNamespace = {
    float: (init) => slot(init),
    int: (init) => slot(init),
    bool: (init) => slot(init),
    string: (init) => slot(init),
    series: (init) => seriesSlot(init),
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
});
