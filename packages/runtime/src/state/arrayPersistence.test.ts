// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../runtimeContext.js";
import {
    isArraySlotSnapshotKey,
    restoreArraySlots,
    serialiseArraySlots,
} from "./arrayPersistence.js";
import { type ArrayStateSlot, createArrayStateSlot } from "./arrayStateSlot.js";

function ctxWith(slots: ReadonlyArray<readonly [string, ArrayStateSlot]>): RuntimeContext {
    return { arraySlots: new Map(slots) } as unknown as RuntimeContext;
}

describe("isArraySlotSnapshotKey", () => {
    it("matches only the :array suffix", () => {
        expect(isArraySlotSnapshotKey("a#0:array")).toBe(true);
        expect(isArraySlotSnapshotKey("dep:fast/a#0:array")).toBe(true);
        expect(isArraySlotSnapshotKey("a#0:state")).toBe(false);
        expect(isArraySlotSnapshotKey("a#0:series")).toBe(false);
        expect(isArraySlotSnapshotKey("ta:a#0")).toBe(false);
    });
});

describe("serialiseArraySlots", () => {
    it("emits JSON-clean entries carrying capacity + both rings", () => {
        const slot = createArrayStateSlot(4);
        slot.handle.push(1);
        slot.onBarClose();
        slot.handle.push(2);
        const entry = serialiseArraySlots(ctxWith([["a:array", slot]]))["a:array"] as Record<
            string,
            unknown
        >;
        expect(entry.kind).toBe("state.array");
        expect(entry.capacity).toBe(4);
        expect(entry.committed).toMatchObject({ filled: 1 });
        expect(entry.tentative).toMatchObject({ filled: 2 });
    });
});

describe("restoreArraySlots", () => {
    it("round-trips committed + tentative rings", () => {
        const original = createArrayStateSlot(4);
        original.handle.push(1);
        original.handle.push(2);
        original.onBarClose(); // committed = [1,2]
        original.handle.push(3); // tentative = [1,2,3]
        const snapshot = serialiseArraySlots(ctxWith([["a:array", original]]));

        const target = ctxWith([]);
        restoreArraySlots(target, snapshot);
        const restored = target.arraySlots.get("a:array");
        expect(restored?.capacity).toBe(4);
        expect(restored?.handle.size).toBe(3);
        expect(restored?.handle.get(0)).toBe(3);
        restored?.onBarTick();
        expect(restored?.handle.size).toBe(2);
        expect(restored?.handle.get(0)).toBe(2);
    });

    it("ignores non-array keys and skips malformed entries", () => {
        const target = ctxWith([]);
        const validBuffer = { headIndex: 0, filled: 1, values: [1, null, null, null] };
        restoreArraySlots(target, {
            "x:state": { committed: 1, tentative: 1 },
            "notRecord:array": 7,
            "wrongKind:array": { kind: "ta.ema" },
            "nonIntCapacity:array": {
                kind: "state.array",
                capacity: 1.5,
                committed: validBuffer,
                tentative: validBuffer,
            },
            "zeroCapacity:array": {
                kind: "state.array",
                capacity: 0,
                committed: validBuffer,
                tentative: validBuffer,
            },
            "badCommitted:array": {
                kind: "state.array",
                capacity: 4,
                committed: "nope",
                tentative: validBuffer,
            },
            "badTentative:array": {
                kind: "state.array",
                capacity: 4,
                committed: validBuffer,
                tentative: "nope",
            },
        });
        expect(target.arraySlots.size).toBe(0);
    });

    it("degrades a capacity-mismatch snapshot to a fresh slot without throwing", () => {
        // The persisted ring shape (capacity 2) no longer matches the recorded
        // capacity (4) → restoreBuffer returns null → slot is skipped.
        const target = ctxWith([]);
        expect(() =>
            restoreArraySlots(target, {
                "a:array": {
                    kind: "state.array",
                    capacity: 4,
                    committed: { headIndex: 0, filled: 1, values: [1, null] },
                    tentative: { headIndex: 0, filled: 1, values: [1, null] },
                },
            }),
        ).not.toThrow();
        expect(target.arraySlots.size).toBe(0);
    });

    it("loads cleanly when no array section is present (clears prior slots)", () => {
        const target = ctxWith([["stale:array", createArrayStateSlot(4)]]);
        restoreArraySlots(target, { "x:state": { committed: 1, tentative: 1 } });
        expect(target.arraySlots.size).toBe(0);
    });
});
