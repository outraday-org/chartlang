// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { NumberSeriesSlot } from "@invinite-org/chartlang-core";

import type { Float64RingBuffer } from "../ringBuffer.js";
import { makeSeriesView } from "../seriesView.js";

/**
 * Runtime slot behind a script-facing `state.series(init)` handle. The
 * `buffer` is the history ring (index 0 = live head); the `view` is the
 * identity-stable {@link NumberSeriesSlot} the script reads and writes;
 * `committedHead` snapshots the head as of the last bar close so a tick
 * can reset the live head before the script refines it.
 *
 * Unlike the scalar `StateSlot`, there is no tentative/committed value
 * split — the head IS the tentative value and history IS committed (a bar
 * advances the ring on close). `committedHead` exists only so a tick's
 * `resetSeriesSlotHead` can undo a prior tick's `replaceHead`.
 *
 * @since 0.9
 * @stable
 * @example
 *     // const slot = createSeriesSlot(new Float64RingBuffer(8), 0);
 *     // slot.view.value = 42;
 *     // slot.view[0]; // 42
 */
export type SeriesSlot = {
    readonly kind: "state.series";
    readonly buffer: Float64RingBuffer;
    readonly view: NumberSeriesSlot;
    committedHead: number;
};

/**
 * Build the identity-stable {@link NumberSeriesSlot} view over a ring
 * buffer. Series reads (`[n]`, `current`, `length`, `valueOf`,
 * `Symbol.toPrimitive`) delegate to a reused {@link makeSeriesView}; the
 * `value` property is added on top — `get` → `buffer.at(0)` (live head),
 * `set` → `buffer.replaceHead(v)` (write-through to the live head). The
 * object's identity is stable across bars, so a script can keep
 * `const s = state.series(0)` at the top of `compute`.
 *
 * @since 0.9
 * @stable
 * @example
 *     // const view = makeSeriesSlotView(buffer);
 *     // view.value = 7; // replaceHead
 *     // +view;          // 7  (valueOf → buffer.at(0))
 *     // view[1];        // one committed bar back
 */
export function makeSeriesSlotView(buffer: Float64RingBuffer): NumberSeriesSlot {
    const reads = makeSeriesView<number>(buffer);
    return new Proxy(reads as NumberSeriesSlot, {
        get(target, prop, receiver) {
            if (prop === "value") return buffer.at(0);
            return Reflect.get(target, prop, receiver);
        },
        set(_target, prop, value) {
            if (prop === "value") {
                buffer.replaceHead(value as number);
                return true;
            }
            return false;
        },
        has(target, prop) {
            if (prop === "value") return true;
            return Reflect.has(target, prop);
        },
    });
}

/**
 * Allocate a fresh {@link SeriesSlot}: seed the live head with `init`
 * (matching `state.float(init)` — a never-written series reads `init` on
 * its allocation bar), set `committedHead = init`, and build the
 * identity-stable view. Later bars the script does not write become `NaN`
 * gaps because the close hook advances the ring with `append(NaN)`.
 *
 * @since 0.9
 * @stable
 * @example
 *     // const slot = createSeriesSlot(new Float64RingBuffer(8), 0);
 *     // slot.view[0]; // 0 (the seeded init on the allocation bar)
 */
export function createSeriesSlot(buffer: Float64RingBuffer, init: number): SeriesSlot {
    buffer.append(init);
    return {
        kind: "state.series",
        buffer,
        view: makeSeriesSlotView(buffer),
        committedHead: init,
    };
}

/**
 * Rebuild a {@link SeriesSlot} over an already-restored ring buffer
 * (snapshot path). The view identity is recreated — acceptable, same as
 * `ta.*` restore.
 *
 * @since 0.9
 * @stable
 * @example
 *     // const slot = restoreSeriesSlot(restoredBuffer, committedHead);
 *     // slot.view[1];
 */
export function restoreSeriesSlot(buffer: Float64RingBuffer, committedHead: number): SeriesSlot {
    return {
        kind: "state.series",
        buffer,
        view: makeSeriesSlotView(buffer),
        committedHead,
    };
}

/**
 * Advance the ring for a new close bar: append a fresh `NaN` head so the
 * prior committed head slides to index 1. Runs once per close, before the
 * script's compute, for every already-allocated slot.
 *
 * @since 0.9
 * @stable
 * @example
 *     // advanceSeriesSlot(slot); // slot.view[0] is now NaN until written
 */
export function advanceSeriesSlot(slot: SeriesSlot): void {
    slot.buffer.append(Number.NaN);
}

/**
 * Commit the live head as the bar-close value, so the next close's
 * `advanceSeriesSlot` retains it and a subsequent tick's
 * `resetSeriesSlotHead` restores it. Runs once per close, after compute.
 *
 * @since 0.9
 * @stable
 * @example
 *     // commitSeriesSlot(slot); // slot.committedHead = slot.view[0]
 */
export function commitSeriesSlot(slot: SeriesSlot): void {
    slot.committedHead = slot.buffer.at(0);
}

/**
 * Reset the live head to the last committed value at the start of a tick,
 * so a tick that re-writes refines from the committed baseline and a tick
 * that does not write reads the committed head. Does NOT advance length.
 *
 * @since 0.9
 * @stable
 * @example
 *     // resetSeriesSlotHead(slot); // slot.view[0] = slot.committedHead
 */
export function resetSeriesSlotHead(slot: SeriesSlot): void {
    slot.buffer.replaceHead(slot.committedHead);
}
