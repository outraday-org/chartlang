// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot, Series } from "@invinite-org/chartlang-core";

import type { ObjectRingBuffer } from "../ringBuffer.js";
import { makeSeriesView } from "../seriesView.js";

/**
 * The non-numeric `state.*Series` slot kinds. The discriminator rides the
 * snapshot entry so the restore router can pick the correct out-of-range
 * default (`false` / `""`) without a separate key suffix per element type.
 *
 * @since 1.5
 * @stable
 * @example
 *     const k: ObjectSeriesKind = "state.boolSeries";
 *     void k;
 */
export type ObjectSeriesKind = "state.boolSeries" | "state.stringSeries";

/**
 * The script-facing view of an {@link ObjectSeriesSlot} — a writable `.value`
 * head **and** an indexable `Series<T>` history (`s[1]`, `s.current`). This is
 * `BoolSeriesSlot` / `StringSeriesSlot` structurally; the generic shape backs
 * both element types from one implementation.
 *
 * @since 1.5
 * @stable
 * @example
 *     // const v: ObjectSeriesSlotView<boolean> = slot.view;
 */
export type ObjectSeriesSlotView<T> = MutableSlot<T> & Series<T>;

/**
 * Runtime slot behind a script-facing `state.boolSeries(init)` /
 * `state.stringSeries(init)` handle — the non-numeric analogue of
 * {@link SeriesSlot}. The `buffer` is an {@link ObjectRingBuffer} (index 0 =
 * live head, out-of-range reads return the element default); the `view` is the
 * identity-stable writable+indexable handle; `committedHead` snapshots the head
 * as of the last bar close so a tick can reset the live head before the script
 * refines it. Mirrors the numeric series lifecycle exactly — only the element
 * type and the out-of-range default differ.
 *
 * @since 1.5
 * @stable
 * @example
 *     // const slot = createObjectSeriesSlot(
 *     //     new ObjectRingBuffer<boolean>(8, false), false, "state.boolSeries");
 *     // slot.view.value = true;
 *     // slot.view[0]; // true
 */
export type ObjectSeriesSlot<T> = {
    readonly kind: ObjectSeriesKind;
    readonly buffer: ObjectRingBuffer<T>;
    readonly view: ObjectSeriesSlotView<T>;
    committedHead: T;
};

/**
 * Build the identity-stable {@link ObjectSeriesSlotView} over an
 * {@link ObjectRingBuffer}. Series reads (`[n]`, `current`, `length`,
 * `valueOf`, `Symbol.toPrimitive`) delegate to a reused {@link makeSeriesView};
 * the `value` property is added on top — `get` → `buffer.at(0)` (live head),
 * `set` → `buffer.replaceHead(v)` (write-through). Identical to the numeric
 * `makeSeriesSlotView`, generalised over the element type.
 *
 * @since 1.5
 * @stable
 * @example
 *     // const view = makeObjectSeriesSlotView(new ObjectRingBuffer<string>(4, ""));
 *     // view.value = "a";
 *     // view[0]; // "a"
 */
export function makeObjectSeriesSlotView<T>(buffer: ObjectRingBuffer<T>): ObjectSeriesSlotView<T> {
    const reads = makeSeriesView<T>(buffer);
    return new Proxy(reads as ObjectSeriesSlotView<T>, {
        get(target, prop, receiver) {
            if (prop === "value") return buffer.at(0);
            return Reflect.get(target, prop, receiver);
        },
        set(_target, prop, value) {
            if (prop === "value") {
                buffer.replaceHead(value as T);
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
 * Allocate a fresh {@link ObjectSeriesSlot}: seed the live head with `init`,
 * set `committedHead = init`, and build the identity-stable view. Later bars
 * the script does not write become the element default (`false` / `""`)
 * because the close hook advances the ring with `append(defaultValue)`.
 *
 * @since 1.5
 * @stable
 * @example
 *     // const slot = createObjectSeriesSlot(
 *     //     new ObjectRingBuffer<boolean>(8, false), true, "state.boolSeries");
 *     // slot.view[0]; // true (the seeded init on the allocation bar)
 */
export function createObjectSeriesSlot<T>(
    buffer: ObjectRingBuffer<T>,
    init: T,
    kind: ObjectSeriesKind,
): ObjectSeriesSlot<T> {
    buffer.append(init);
    return {
        kind,
        buffer,
        view: makeObjectSeriesSlotView(buffer),
        committedHead: init,
    };
}

/**
 * Rebuild an {@link ObjectSeriesSlot} over an already-restored ring buffer
 * (snapshot path). The view identity is recreated — acceptable, same as the
 * numeric series / `ta.*` restore.
 *
 * @since 1.5
 * @stable
 * @example
 *     // const slot = restoreObjectSeriesSlot(restoredBuffer, false, "state.boolSeries");
 */
export function restoreObjectSeriesSlot<T>(
    buffer: ObjectRingBuffer<T>,
    committedHead: T,
    kind: ObjectSeriesKind,
): ObjectSeriesSlot<T> {
    return {
        kind,
        buffer,
        view: makeObjectSeriesSlotView(buffer),
        committedHead,
    };
}

/**
 * Advance the ring for a new close bar: append a fresh element-default head so
 * the prior committed head slides to index 1. Runs once per close, before the
 * script's compute, for every already-allocated slot. The default-not-`NaN`
 * head is the non-numeric analogue of {@link advanceSeriesSlot}.
 *
 * @since 1.5
 * @stable
 * @example
 *     // advanceObjectSeriesSlot(slot); // slot.view[0] is the default until written
 */
export function advanceObjectSeriesSlot<T>(slot: ObjectSeriesSlot<T>): void {
    slot.buffer.append(slot.buffer.defaultValue);
}

/**
 * Commit the live head as the bar-close value, so the next close's
 * {@link advanceObjectSeriesSlot} retains it and a subsequent tick's
 * {@link resetObjectSeriesSlotHead} restores it. Runs once per close, after
 * compute.
 *
 * @since 1.5
 * @stable
 * @example
 *     // commitObjectSeriesSlot(slot); // slot.committedHead = slot.view[0]
 */
export function commitObjectSeriesSlot<T>(slot: ObjectSeriesSlot<T>): void {
    slot.committedHead = slot.buffer.at(0);
}

/**
 * Reset the live head to the last committed value at the start of a tick, so a
 * tick that re-writes refines from the committed baseline and a tick that does
 * not write reads the committed head. Does NOT advance length.
 *
 * @since 1.5
 * @stable
 * @example
 *     // resetObjectSeriesSlotHead(slot); // slot.view[0] = slot.committedHead
 */
export function resetObjectSeriesSlotHead<T>(slot: ObjectSeriesSlot<T>): void {
    slot.buffer.replaceHead(slot.committedHead);
}
