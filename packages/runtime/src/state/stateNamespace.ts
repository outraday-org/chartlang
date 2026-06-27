// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    BoolSeriesSlot,
    Color,
    MutableArraySlot,
    MutableMapSlot,
    MutableSlot,
    NumberSeriesSlot,
    StateNamespace,
    StringSeriesSlot,
} from "@invinite-org/chartlang-core";

import { Float64RingBuffer, ObjectRingBuffer } from "../ringBuffer.js";
import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { createArrayStateSlot } from "./arrayStateSlot.js";
import { type MapKey, createMapStore } from "./mapStore.js";
import {
    createObjectSeriesSlot,
    type ObjectSeriesKind,
    type ObjectSeriesSlot,
    type ObjectSeriesSlotView,
} from "./objectSeriesSlot.js";
import { createSeriesSlot } from "./seriesSlot.js";
import { asMutableSlot, StateSlot } from "./stateSlot.js";

type StoredStateSlot<T> = {
    readonly committed: T;
    readonly tentative: T;
};

/**
 * Compose the runtime's `state.*` slot key from the compiler-injected
 * `slotId` plus the active context's `slotIdPrefix`. The primary runner
 * has an absent / empty prefix — its keys stay byte-identical to the
 * Phase-1 `${slotId}:state` shape so single-script snapshots load
 * unchanged. `DepRunner` contexts carry `dep:<localId>/`,
 * `SiblingRunner` contexts carry `export:<exportName>/`.
 *
 * @since 0.7
 * @internal
 */
const stateKey = (ctx: RuntimeContext, slotId: string): string =>
    `${ctx.slotIdPrefix ?? ""}${slotId}:state`;

/**
 * Compose the runtime's `state.series` slot key — the `:series` suffix
 * (vs `:state`) lets the snapshot restore router tell a series slot from a
 * scalar `state.*` slot. The `slotIdPrefix` isolation rule is identical to
 * {@link stateKey}.
 *
 * @since 0.9
 * @internal
 */
const seriesKey = (ctx: RuntimeContext, slotId: string): string =>
    `${ctx.slotIdPrefix ?? ""}${slotId}:series`;

/**
 * Compose the runtime's `state.array` slot key — the `:array` suffix (vs
 * `:state` / `:series`) lets the snapshot restore router tell an array slot
 * from a scalar or series slot. The `slotIdPrefix` isolation rule is identical
 * to {@link stateKey}.
 *
 * @since 1.3
 * @internal
 */
const arrayKey = (ctx: RuntimeContext, slotId: string): string =>
    `${ctx.slotIdPrefix ?? ""}${slotId}:array`;

/**
 * Compose the runtime's `state.map` slot key — the `:map` suffix (vs `:state` /
 * `:series` / `:array`) lets the snapshot restore router tell a map slot from a
 * scalar, series, or array slot. The `slotIdPrefix` isolation rule is identical
 * to {@link stateKey}.
 *
 * @since 1.4
 * @internal
 */
const mapKey = (ctx: RuntimeContext, slotId: string): string =>
    `${ctx.slotIdPrefix ?? ""}${slotId}:map`;

/**
 * Compose the runtime non-numeric series slot key — the `:objseries` suffix
 * (vs `:series` / `:array` / `:map`) lets the snapshot restore router tell a
 * `state.boolSeries` / `state.stringSeries` slot from every other family. One
 * suffix backs both element kinds. The `slotIdPrefix` isolation rule is
 * identical to {@link stateKey}.
 *
 * @since 1.5
 * @internal
 */
const objectSeriesKey = (ctx: RuntimeContext, slotId: string): string =>
    `${ctx.slotIdPrefix ?? ""}${slotId}:objseries`;

function getCtx(name: string): RuntimeContext {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) {
        throw new Error(`${name} called outside an active script step`);
    }
    return ctx;
}

function getOrAllocate<T>(
    name: string,
    slotId: string,
    init: T,
    tickPersistent: boolean,
): MutableSlot<T> {
    const ctx = getCtx(name);
    const key = stateKey(ctx, slotId);
    const existing = ctx.stateSlots.get(key);
    if (existing !== undefined) {
        return asMutableSlot(existing as StateSlot<T>);
    }

    const stored = ctx.stateStore.get<StoredStateSlot<T>>(key);
    const slot = new StateSlot<T>(stored?.committed ?? init, tickPersistent);
    if (stored !== undefined) {
        slot.tentative = stored.tentative;
    }
    ctx.stateSlots.set(key, slot as StateSlot<unknown>);
    return asMutableSlot(slot);
}

function getOrAllocateSeries(slotId: string, init: number): NumberSeriesSlot {
    const ctx = getCtx("state.series");
    const key = seriesKey(ctx, slotId);
    const existing = ctx.seriesSlots.get(key);
    if (existing !== undefined) {
        return existing.view;
    }
    // Size the ring to the runner's global capacity (`maxLookback + 1`, or
    // the 5000-slot dynamic fallback). Warm restart rehydrates `seriesSlots`
    // up front via `restoreSeriesSlots`, so a restored slot is found above
    // and this seed path only runs for a genuinely first-seen callsite.
    const slot = createSeriesSlot(new Float64RingBuffer(ctx.stream.ohlcv.close.capacity), init);
    ctx.seriesSlots.set(key, slot);
    return slot.view;
}

function getOrAllocateObjectSeries<T>(
    slotId: string,
    init: T,
    kind: ObjectSeriesKind,
    defaultValue: T,
): ObjectSeriesSlotView<T> {
    const ctx = getCtx(kind);
    const key = objectSeriesKey(ctx, slotId);
    const existing = ctx.objectSeriesSlots.get(key);
    if (existing !== undefined) {
        return existing.view as ObjectSeriesSlotView<T>;
    }
    // Size the ring to the runner's global capacity, mirroring the numeric
    // series allocator. Warm restart rehydrates `objectSeriesSlots` up front via
    // `restoreObjectSeriesSlots`, so this seed path only runs for a genuinely
    // first-seen callsite.
    const slot = createObjectSeriesSlot(
        new ObjectRingBuffer<T>(ctx.stream.ohlcv.close.capacity, defaultValue),
        init,
        kind,
    );
    ctx.objectSeriesSlots.set(key, slot as ObjectSeriesSlot<unknown>);
    return slot.view;
}

function getOrAllocateArray(slotId: string, capacity: number): MutableArraySlot<number> {
    const ctx = getCtx("state.array");
    const key = arrayKey(ctx, slotId);
    const existing = ctx.arraySlots.get(key);
    if (existing !== undefined) {
        return existing.handle;
    }
    // No store-consult / seed: an empty collection starts empty, and warm
    // restart rehydrates `arraySlots` up front via `restoreArraySlots` (mirrors
    // the `state.series` allocator), so this path only runs for a first-seen
    // callsite.
    const slot = createArrayStateSlot(capacity);
    ctx.arraySlots.set(key, slot);
    return slot.handle;
}

function getOrAllocateMap(slotId: string, capacity: number): MutableMapSlot<MapKey, number> {
    const ctx = getCtx("state.map");
    const key = mapKey(ctx, slotId);
    const existing = ctx.mapSlots.get(key);
    if (existing !== undefined) {
        return existing.handle;
    }
    // No store-consult / seed: an empty collection starts empty, and warm
    // restart rehydrates `mapSlots` up front via `restoreMapSlots` (mirrors the
    // `state.array` allocator), so this path only runs for a first-seen callsite.
    const slot = createMapStore(capacity);
    ctx.mapSlots.set(key, slot);
    return slot.handle;
}

/**
 * Build the runtime `state` namespace installed on `ComputeContext`.
 * Each function accepts the compiler-injected `slotId` as its first
 * parameter, then the script-facing init value.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns = buildStateNamespace();
 *     void ns.float;
 */
export function buildStateNamespace(): StateNamespace {
    const ns = {
        float: (slotId: string, init: number): MutableSlot<number> =>
            getOrAllocate("state.float", slotId, init, false),
        int: (slotId: string, init: number): MutableSlot<number> =>
            getOrAllocate("state.int", slotId, init, false),
        bool: (slotId: string, init: boolean): MutableSlot<boolean> =>
            getOrAllocate("state.bool", slotId, init, false),
        string: (slotId: string, init: string): MutableSlot<string> =>
            getOrAllocate("state.string", slotId, init, false),
        series: (slotId: string, init: number): NumberSeriesSlot =>
            getOrAllocateSeries(slotId, init),
        color: (slotId: string, init: Color): MutableSlot<Color> =>
            getOrAllocate("state.color", slotId, init, false),
        boolSeries: (slotId: string, init: boolean): BoolSeriesSlot =>
            getOrAllocateObjectSeries(slotId, init, "state.boolSeries", false),
        stringSeries: (slotId: string, init: string): StringSeriesSlot =>
            getOrAllocateObjectSeries(slotId, init, "state.stringSeries", ""),
        array: (slotId: string, capacity: number): MutableArraySlot<number> =>
            getOrAllocateArray(slotId, capacity),
        map: (slotId: string, capacity: number): MutableMapSlot<MapKey, number> =>
            getOrAllocateMap(slotId, capacity),
        tick: {
            float: (slotId: string, init: number): MutableSlot<number> =>
                getOrAllocate("state.tick.float", slotId, init, true),
            int: (slotId: string, init: number): MutableSlot<number> =>
                getOrAllocate("state.tick.int", slotId, init, true),
            bool: (slotId: string, init: boolean): MutableSlot<boolean> =>
                getOrAllocate("state.tick.bool", slotId, init, true),
            string: (slotId: string, init: string): MutableSlot<string> =>
                getOrAllocate("state.tick.string", slotId, init, true),
        },
    };
    Object.freeze(ns.tick);
    Object.freeze(ns);
    return ns as unknown as StateNamespace;
}
