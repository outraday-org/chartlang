// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { ObjectRingBuffer } from "../ringBuffer.js";
import type { RuntimeContext } from "../runtimeContext.js";
import {
    isObjectSeriesSlotSnapshotKey,
    restoreObjectSeriesSlots,
    serialiseObjectSeriesSlots,
} from "./objectSeriesPersistence.js";
import { createObjectSeriesSlot, type ObjectSeriesSlot } from "./objectSeriesSlot.js";

function ctxWith(
    slots: ReadonlyArray<readonly [string, ObjectSeriesSlot<unknown>]>,
): RuntimeContext {
    return { objectSeriesSlots: new Map(slots) } as unknown as RuntimeContext;
}

function boolSlot(init: boolean): ObjectSeriesSlot<unknown> {
    return createObjectSeriesSlot(
        new ObjectRingBuffer<boolean>(4, false),
        init,
        "state.boolSeries",
    ) as ObjectSeriesSlot<unknown>;
}

describe("isObjectSeriesSlotSnapshotKey", () => {
    it("matches only the :objseries suffix and never collides with :series", () => {
        expect(isObjectSeriesSlotSnapshotKey("s#0:objseries")).toBe(true);
        expect(isObjectSeriesSlotSnapshotKey("dep:fast/s#0:objseries")).toBe(true);
        expect(isObjectSeriesSlotSnapshotKey("s#0:series")).toBe(false);
        expect(isObjectSeriesSlotSnapshotKey("s#0:state")).toBe(false);
        expect(isObjectSeriesSlotSnapshotKey("ta:s#0")).toBe(false);
    });
});

describe("serialiseObjectSeriesSlots", () => {
    it("emits no entries when no non-numeric series slot is allocated", () => {
        // A script with only numeric/scalar slots contributes an empty spread,
        // so existing snapshots stay byte-identical.
        expect(serialiseObjectSeriesSlots(ctxWith([]))).toEqual({});
    });

    it("emits JSON-clean entries carrying kind, raw values, and committedHead", () => {
        const slot = boolSlot(false);
        slot.view.value = true;
        const entry = serialiseObjectSeriesSlots(ctxWith([["a:objseries", slot]]))[
            "a:objseries"
        ] as Record<string, unknown>;
        expect(entry.kind).toBe("state.boolSeries");
        expect(entry.committedHead).toBe(false);
        const buffer = entry.buffer as Record<string, unknown>;
        expect(buffer.values).toEqual([true, false, false, false]);
    });
});

describe("restoreObjectSeriesSlots", () => {
    it("round-trips a bool slot, preserving history and committedHead", () => {
        const original = boolSlot(false);
        original.view.value = true;
        original.committedHead = true;
        const snapshot = serialiseObjectSeriesSlots(ctxWith([["a:objseries", original]]));

        const target = ctxWith([]);
        restoreObjectSeriesSlots(target, snapshot, 4);
        const restored = target.objectSeriesSlots.get("a:objseries");
        expect(restored?.view[0]).toBe(true);
        expect(restored?.committedHead).toBe(true);
    });

    it("round-trips a string slot too", () => {
        const original = createObjectSeriesSlot(
            new ObjectRingBuffer<string>(4, ""),
            "seed",
            "state.stringSeries",
        ) as ObjectSeriesSlot<unknown>;
        original.view.value = "head";
        const snapshot = serialiseObjectSeriesSlots(ctxWith([["s:objseries", original]]));

        const target = ctxWith([]);
        restoreObjectSeriesSlots(target, snapshot, 4);
        expect(target.objectSeriesSlots.get("s:objseries")?.view[0]).toBe("head");
    });

    it("ignores non-objseries keys and skips every malformed entry shape", () => {
        const target = ctxWith([]);
        restoreObjectSeriesSlots(
            target,
            {
                // Wrong suffix — never considered.
                "x:state": { committed: 1, tentative: 1 },
                // Not a record.
                "notRecord:objseries": "nope",
                // Unknown kind.
                "wrongKind:objseries": { kind: "ta.ema" },
                // Buffer is not a record.
                "noBuffer:objseries": {
                    kind: "state.boolSeries",
                    buffer: "nope",
                    committedHead: false,
                },
                // headIndex / filled not integers.
                "badHead:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 1.5, filled: 1, values: [true, false, false, false] },
                    committedHead: false,
                },
                "badFilled:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 0, filled: 1.5, values: [true, false, false, false] },
                    committedHead: false,
                },
                // values not an array.
                "notArray:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 0, filled: 1, values: "nope" },
                    committedHead: false,
                },
                // A non-boolean element fails the element guard.
                "badValues:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 0, filled: 1, values: [1, false, false, false] },
                    committedHead: false,
                },
                // committedHead is the wrong element type.
                "badCommitted:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 0, filled: 1, values: [true, false, false, false] },
                    committedHead: "oops",
                },
                // Structurally valid but capacity-incompatible → ring restore throws.
                "badBuffer:objseries": {
                    kind: "state.boolSeries",
                    buffer: { headIndex: 99, filled: 1, values: [true, false, false, false] },
                    committedHead: false,
                },
            },
            4,
        );
        expect(target.objectSeriesSlots.size).toBe(0);
    });

    it("clears prior slots when no objseries section is present", () => {
        const target = ctxWith([["stale:objseries", boolSlot(false)]]);
        restoreObjectSeriesSlots(target, { "x:state": { committed: 1, tentative: 1 } }, 4);
        expect(target.objectSeriesSlots.size).toBe(0);
    });
});
