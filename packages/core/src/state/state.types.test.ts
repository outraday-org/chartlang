// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { MutableSlot } from "./mutableSlot";
import type { StateNamespace } from "./state";

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

const runtimeState: StateNamespace = {
    float: (init) => slot(init),
    int: (init) => slot(init),
    bool: (init) => slot(init),
    string: (init) => slot(init),
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
});
