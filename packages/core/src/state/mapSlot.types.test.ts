// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { MutableMapSlot } from "./mapSlot.js";
import type { MutableSlot } from "./mutableSlot.js";

// A runtime stand-in for the slot the runtime installs — never the real
// `state.map(...)` hole (which throws). Mirrors the `arraySlot()` helper in
// `arraySlot.types.test.ts` so the expect-type matchers have a value to
// inspect.
function mapSlot<K extends string | number, V>(): MutableMapSlot<K, V> {
    const store = new Map<K, V>();
    return {
        set(key: K, value: V) {
            store.set(key, value);
        },
        get(key: K) {
            return store.get(key);
        },
        has(key: K) {
            return store.has(key);
        },
        delete(key: K) {
            return store.delete(key);
        },
        clear() {
            store.clear();
        },
        get size() {
            return store.size;
        },
        keyAt(index: number) {
            return [...store.keys()][index];
        },
    };
}

describe("MutableMapSlot type surface", () => {
    const m = mapSlot<number, number>();

    it("exposes the keyed-collection method + readonly-field surface", () => {
        expectTypeOf(m).toEqualTypeOf<MutableMapSlot<number, number>>();

        // `get` distinguishes absent (undefined) from a stored value.
        expectTypeOf(m.get(10)).toEqualTypeOf<number | undefined>();
        // Membership / removal are booleans.
        expectTypeOf(m.has(10)).toEqualTypeOf<boolean>();
        expectTypeOf(m.delete(10)).toEqualTypeOf<boolean>();
        // Bounded indexing — `keyAt` resolves to the key type or undefined.
        expectTypeOf(m.keyAt(0)).toEqualTypeOf<number | undefined>();
        // Entry count is a number.
        expectTypeOf(m.size).toEqualTypeOf<number>();

        // Mutating methods are callable with the declared param types.
        expectTypeOf(m.set).parameter(0).toEqualTypeOf<number>();
        expectTypeOf(m.set).parameter(1).toEqualTypeOf<number>();
        expectTypeOf(m.set(10, 1)).toEqualTypeOf<void>();
        expectTypeOf(m.clear()).toEqualTypeOf<void>();
    });

    it("is a plain handle — NOT a number-coercible MutableSlot/Series", () => {
        // No scalar `.value` (the deliberate contrast with state.series).
        expectTypeOf<MutableMapSlot<number, number>>().not.toHaveProperty("value");
        // Not assignable to MutableSlot — it is a distinct interface.
        expectTypeOf<MutableMapSlot<number, number>>().not.toMatchTypeOf<MutableSlot<number>>();
    });

    it("accepts string and number keys but rejects other key types", () => {
        // string keys type-check.
        const byString = mapSlot<string, number>();
        expectTypeOf(byString.get("k")).toEqualTypeOf<number | undefined>();

        // A non-`string | number` key parameter does not satisfy the constraint.
        const rejectsObjectKey = (): void => {
            // @ts-expect-error -- K must extend `string | number`.
            const bad: MutableMapSlot<{ id: number }, number> = mapSlot();
            void bad;
        };
        expectTypeOf(rejectsObjectKey).toEqualTypeOf<() => void>();
    });

    it("does not type-check number coercion (`+m`)", () => {
        const coerce = (s: MutableMapSlot<number, number>): number => {
            // @ts-expect-error -- a map handle is a collection, not a number.
            return +s;
        };
        expectTypeOf(coerce).parameter(0).toEqualTypeOf<MutableMapSlot<number, number>>();
    });

    it("treats size as readonly", () => {
        // Type-only: the assignment is checked by the compiler but never run.
        const writeReadonly = (s: MutableMapSlot<number, number>): void => {
            // @ts-expect-error -- `size` is readonly.
            s.size = 1;
        };
        expectTypeOf(writeReadonly).parameter(0).toEqualTypeOf<MutableMapSlot<number, number>>();
    });
});
