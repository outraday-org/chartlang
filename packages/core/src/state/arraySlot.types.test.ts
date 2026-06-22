// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { MutableArraySlot } from "./arraySlot.js";
import type { MutableSlot } from "./mutableSlot.js";

// A runtime stand-in for the slot the runtime installs — never the real
// `state.array(...)` hole (which throws). Mirrors the `slot()` helper in
// `state.types.test.ts` so the expect-type matchers have a value to inspect.
function arraySlot<T>(empty: T): MutableArraySlot<T> {
    const items: T[] = [];
    return {
        push(value: T) {
            items.push(value);
        },
        get(n: number) {
            return items[items.length - 1 - n] ?? empty;
        },
        last() {
            return items[items.length - 1] ?? empty;
        },
        clear() {
            items.length = 0;
        },
        get size() {
            return items.length;
        },
        get capacity() {
            return 8;
        },
    };
}

describe("MutableArraySlot type surface", () => {
    const a = arraySlot<number>(Number.NaN);

    it("exposes the bounded-collection method + readonly-field surface", () => {
        expectTypeOf(a).toEqualTypeOf<MutableArraySlot<number>>();

        // Element reads resolve to the element type.
        expectTypeOf(a.get(0)).toEqualTypeOf<number>();
        expectTypeOf(a.last()).toEqualTypeOf<number>();

        // Bookkeeping fields are numbers.
        expectTypeOf(a.size).toEqualTypeOf<number>();
        expectTypeOf(a.capacity).toEqualTypeOf<number>();

        // Mutating methods are callable.
        expectTypeOf(a.push).parameter(0).toEqualTypeOf<number>();
        expectTypeOf(a.push(1)).toEqualTypeOf<void>();
        expectTypeOf(a.clear()).toEqualTypeOf<void>();
    });

    it("is a plain handle — NOT a number-coercible MutableSlot/Series", () => {
        // No scalar `.value` (the deliberate contrast with state.series).
        expectTypeOf<MutableArraySlot<number>>().not.toHaveProperty("value");
        // Not assignable to MutableSlot — it is a distinct interface.
        expectTypeOf<MutableArraySlot<number>>().not.toMatchTypeOf<MutableSlot<number>>();
    });

    it("treats size and capacity as readonly", () => {
        // Type-only: the assignments are checked by the compiler but never run
        // (a runtime getter-only assignment would throw). The `@ts-expect-error`
        // directives fail the build if `size`/`capacity` ever lose `readonly`.
        const writeReadonly = (s: MutableArraySlot<number>): void => {
            // @ts-expect-error -- `size` is readonly.
            s.size = 1;
            // @ts-expect-error -- `capacity` is readonly.
            s.capacity = 1;
        };
        expectTypeOf(writeReadonly).parameter(0).toEqualTypeOf<MutableArraySlot<number>>();
    });
});
