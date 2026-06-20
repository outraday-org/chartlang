// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import type { RuntimeContext } from "../runtimeContext.js";
import {
    isSeriesSlotSnapshotKey,
    restoreSeriesSlots,
    serialiseSeriesSlots,
} from "./seriesPersistence.js";
import { createSeriesSlot, type SeriesSlot } from "./seriesSlot.js";

function ctxWith(slots: ReadonlyArray<readonly [string, SeriesSlot]>): RuntimeContext {
    return { seriesSlots: new Map(slots) } as unknown as RuntimeContext;
}

describe("isSeriesSlotSnapshotKey", () => {
    it("matches only the :series suffix", () => {
        expect(isSeriesSlotSnapshotKey("s#0:series")).toBe(true);
        expect(isSeriesSlotSnapshotKey("dep:fast/s#0:series")).toBe(true);
        expect(isSeriesSlotSnapshotKey("s#0:state")).toBe(false);
        expect(isSeriesSlotSnapshotKey("ta:s#0")).toBe(false);
    });
});

describe("serialiseSeriesSlots", () => {
    it("emits JSON-clean entries and nulls a NaN committedHead", () => {
        const slot = createSeriesSlot(new Float64RingBuffer(4), 5);
        slot.view.value = 7;
        const finite = ctxWith([["a:series", slot]]);
        const entry = serialiseSeriesSlots(finite)["a:series"] as Record<string, unknown>;
        expect(entry.kind).toBe("state.series");
        expect(entry.committedHead).toBe(5);

        slot.committedHead = Number.NaN;
        const nanEntry = serialiseSeriesSlots(finite)["a:series"] as Record<string, unknown>;
        expect(nanEntry.committedHead).toBeNull();
    });
});

describe("restoreSeriesSlots", () => {
    it("round-trips a slot and maps a null committedHead back to NaN", () => {
        const original = createSeriesSlot(new Float64RingBuffer(4), 3);
        original.view.value = 8;
        original.committedHead = Number.NaN;
        const snapshot = serialiseSeriesSlots(ctxWith([["a:series", original]]));

        const target = ctxWith([]);
        restoreSeriesSlots(target, snapshot, 4);
        const restored = target.seriesSlots.get("a:series");
        expect(restored?.view[0]).toBe(8);
        expect(Number.isNaN(restored?.committedHead ?? 0)).toBe(true);
    });

    it("ignores non-series keys and skips malformed entries", () => {
        const target = ctxWith([]);
        restoreSeriesSlots(
            target,
            {
                "x:state": { committed: 1, tentative: 1 },
                "bad:series": { kind: "state.series", buffer: "nope", committedHead: 1 },
                "wrongKind:series": { kind: "ta.ema" },
                "nanHead:series": {
                    kind: "state.series",
                    buffer: { headIndex: 0, filled: 1, values: [1, null, null, null] },
                    committedHead: "oops",
                },
                "badBuffer:series": {
                    kind: "state.series",
                    buffer: { headIndex: 99, filled: 1, values: [1, null, null, null] },
                    committedHead: 1,
                },
                // headIndex is a valid integer but filled is not — exercises the
                // right operand of the `isInteger` guard.
                "badFilled:series": {
                    kind: "state.series",
                    buffer: { headIndex: 0, filled: 1.5, values: [1, null, null, null] },
                    committedHead: 1,
                },
                // A non-finite entry in `values` fails the array predicate.
                "badValues:series": {
                    kind: "state.series",
                    buffer: { headIndex: 0, filled: 1, values: ["x", null, null, null] },
                    committedHead: 1,
                },
            },
            4,
        );
        expect(target.seriesSlots.size).toBe(0);
    });

    it("loads cleanly when no series section is present", () => {
        const target = ctxWith([["stale:series", createSeriesSlot(new Float64RingBuffer(4), 0)]]);
        restoreSeriesSlots(target, { "x:state": { committed: 1, tentative: 1 } }, 4);
        // The clear-then-restore wipes the prior slot; no series keys ⇒ empty.
        expect(target.seriesSlots.size).toBe(0);
    });
});
