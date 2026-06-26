// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../runtimeContext.js";
import { restoreMapSlots, serialiseMapSlots } from "./mapPersistence.js";
import { type MapKey, MapStore } from "./mapStore.js";

type Op =
    | Readonly<{ kind: "set"; key: MapKey; value: number }>
    | Readonly<{ kind: "delete"; key: MapKey }>;

// Reference model: a plain insertion-ordered Map with the same FIFO eviction
// rule the store implements. The store's contract is "JS Map semantics +
// oldest-inserted eviction at capacity", so the model is the spec.
function applyOp(model: Map<MapKey, number>, capacity: number, op: Op): void {
    if (op.kind === "delete") {
        model.delete(op.key);
        return;
    }
    if (model.has(op.key)) {
        model.set(op.key, op.value);
        return;
    }
    if (model.size >= capacity) {
        const oldest = model.keys().next();
        if (!oldest.done) model.delete(oldest.value);
    }
    if (model.size < capacity) model.set(op.key, op.value);
}

const keyArb = fc.oneof(fc.integer({ min: 0, max: 5 }), fc.constantFrom("a", "b", "c", "d"));
const opArb: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
        kind: fc.constant("set" as const),
        key: keyArb,
        value: fc.double({ noNaN: true }),
    }),
    fc.record({ kind: fc.constant("delete" as const), key: keyArb }),
);

describe("MapStore property", () => {
    it("tracks the reference model: size, get, has, keyAt, and size <= capacity", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 6 }),
                fc.array(opArb, { maxLength: 40 }),
                (capacity, ops) => {
                    const slot = new MapStore(capacity);
                    const model = new Map<MapKey, number>();
                    for (const op of ops) {
                        applyOp(model, capacity, op);
                        if (op.kind === "set" && model.has(op.key)) {
                            // Every accepted set is immediately readable.
                            expect(slot.handle.set(op.key, op.value)).toBeUndefined();
                        } else if (op.kind === "set") {
                            slot.handle.set(op.key, op.value);
                        } else {
                            slot.handle.delete(op.key);
                        }

                        expect(slot.handle.size).toBe(model.size);
                        expect(slot.handle.size).toBeLessThanOrEqual(capacity);
                        const keys = [...model.keys()];
                        // size === distinct live keys, in insertion order.
                        for (let i = 0; i < keys.length; i += 1) {
                            const key = keys[i] as MapKey;
                            expect(slot.handle.keyAt(i)).toBe(key);
                            expect(slot.handle.has(key)).toBe(true);
                            expect(slot.handle.get(key)).toBe(model.get(key));
                        }
                        expect(slot.handle.keyAt(keys.length)).toBeUndefined();
                    }
                },
            ),
        );
    });

    it("snapshot -> mutate -> restore round-trips the committed contents", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 6 }),
                fc.array(opArb, { maxLength: 20 }),
                fc.array(opArb, { maxLength: 8 }),
                (capacity, committedOps, tentativeOps) => {
                    const slot = new MapStore(capacity);
                    for (const op of committedOps) {
                        if (op.kind === "set") slot.handle.set(op.key, op.value);
                        else slot.handle.delete(op.key);
                    }
                    slot.onBarClose();
                    const committedAfter = [...slot.committedMap.entries()];

                    const snapshot = serialiseMapSlots({
                        mapSlots: new Map([["a:map", slot]]),
                    } as unknown as RuntimeContext);

                    // Mutate after the snapshot — the restored slot must not see it.
                    for (const op of tentativeOps) {
                        if (op.kind === "set") slot.handle.set(op.key, op.value);
                        else slot.handle.delete(op.key);
                    }

                    const target = { mapSlots: new Map() } as unknown as RuntimeContext;
                    restoreMapSlots(target, snapshot);
                    const restored = target.mapSlots.get("a:map");
                    restored?.onBarTick(); // expose committed contents on the handle
                    expect([...(restored?.tentativeMap.entries() ?? [])]).toEqual(committedAfter);
                },
            ),
        );
    });

    it("a head-replacing tick always discards in-progress sets", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 6 }),
                fc.array(opArb, { maxLength: 20 }),
                fc.array(opArb, { maxLength: 8 }),
                (capacity, committedOps, tickOps) => {
                    const slot = new MapStore(capacity);
                    for (const op of committedOps) {
                        if (op.kind === "set") slot.handle.set(op.key, op.value);
                        else slot.handle.delete(op.key);
                    }
                    slot.onBarClose();
                    const committedSnapshot = [...slot.committedMap.entries()];

                    for (const op of tickOps) {
                        if (op.kind === "set") slot.handle.set(op.key, op.value);
                        else slot.handle.delete(op.key);
                    }
                    slot.onBarTick();
                    expect([...slot.tentativeMap.entries()]).toEqual(committedSnapshot);
                },
            ),
        );
    });
});
