// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { inMemoryStateStore } from "./stateStore.js";

describe("inMemoryStateStore", () => {
    it("returns undefined for unknown slots and false from has()", () => {
        const store = inMemoryStateStore();
        expect(store.get("missing")).toBeUndefined();
        expect(store.has("missing")).toBe(false);
    });

    it("round-trips values via get/set with type narrowing", () => {
        const store = inMemoryStateStore();
        store.set<{ count: number }>("ta:ema:slot#0", { count: 3 });
        expect(store.has("ta:ema:slot#0")).toBe(true);
        expect(store.get<{ count: number }>("ta:ema:slot#0")).toEqual({ count: 3 });
    });

    it("last-write-wins on the same slot id", () => {
        const store = inMemoryStateStore();
        store.set<number>("slot#0", 1);
        store.set<number>("slot#0", 2);
        store.set<number>("slot#0", 3);
        expect(store.get<number>("slot#0")).toBe(3);
    });

    it("clear() drops every slot", () => {
        const store = inMemoryStateStore();
        store.set("a", 1);
        store.set("b", 2);
        store.clear();
        expect(store.has("a")).toBe(false);
        expect(store.has("b")).toBe(false);
        expect(store.get("a")).toBeUndefined();
    });

    it("returns independent stores per call", () => {
        const a = inMemoryStateStore();
        const b = inMemoryStateStore();
        a.set("x", 1);
        expect(b.has("x")).toBe(false);
    });
});

describe("inMemoryStateStore property invariants", () => {
    it("N random set/get pairs preserve last-write-wins per id", () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 8 }), fc.integer()), {
                    minLength: 1,
                    maxLength: 50,
                }),
                (writes) => {
                    const store = inMemoryStateStore();
                    const expected = new Map<string, number>();
                    for (const [id, value] of writes) {
                        store.set<number>(id, value);
                        expected.set(id, value);
                    }
                    for (const [id, value] of expected) {
                        expect(store.has(id)).toBe(true);
                        expect(store.get<number>(id)).toBe(value);
                    }
                },
            ),
        );
    });
});
