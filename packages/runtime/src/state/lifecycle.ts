// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RuntimeContext } from "../runtimeContext.js";
import { advanceSeriesSlot, commitSeriesSlot, resetSeriesSlotHead } from "./seriesSlot.js";

/**
 * Persisted representation for a runtime state slot. Keys use
 * `${slotId}:state`, matching the compiler-injected slot id plus the
 * state namespace suffix.
 *
 * @since 0.4
 * @stable
 * @example
 *     const snapshot: StateSlotSnapshot<number> = {
 *         committed: 1,
 *         tentative: 2,
 *     };
 *     void snapshot;
 */
export type StateSlotSnapshot<T> = {
    readonly committed: T;
    readonly tentative: T;
};

/**
 * Reset all non-`state.tick.*` tentative values before tick compute.
 *
 * @since 0.4
 * @stable
 * @example
 *     // resetTentativeStateSlots(ctx);
 *     const called = true;
 *     void called;
 */
export function resetTentativeStateSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.stateSlots.values()) {
        slot.onBarTick();
    }
}

/**
 * Commit all non-`state.tick.*` tentative values after close compute.
 *
 * @since 0.4
 * @stable
 * @example
 *     // commitStateSlots(ctx);
 *     const called = true;
 *     void called;
 */
export function commitStateSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.stateSlots.values()) {
        slot.onBarClose();
    }
}

/**
 * Flush runtime state slots into the backing {@link StateStore}.
 *
 * @since 0.4
 * @stable
 * @example
 *     // flushStateSlots(ctx);
 *     const called = true;
 *     void called;
 */
export function flushStateSlots(ctx: RuntimeContext): void {
    for (const [key, slot] of ctx.stateSlots.entries()) {
        ctx.stateStore.set<StateSlotSnapshot<unknown>>(key, {
            committed: slot.committed,
            tentative: slot.tentative,
        });
    }
}

/**
 * Serialise runtime state slots into a snapshot payload.
 *
 * @since 0.5
 * @stable
 * @example
 *     // const slots = serialiseStateSlots(ctx);
 *     const slots = {};
 *     void slots;
 */
export function serialiseStateSlots(ctx: RuntimeContext): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, slot] of ctx.stateSlots.entries()) {
        out[key] = {
            committed: slot.serialise(slot.committed),
            tentative: slot.serialise(slot.tentative),
        };
    }
    return Object.freeze(out);
}

/**
 * Seed restored state-slot payloads into the backing slot store.
 *
 * @since 0.5
 * @stable
 * @example
 *     // restoreStateSlots(ctx, snapshot.slots);
 *     const restored = true;
 *     void restored;
 */
export function restoreStateSlots(
    ctx: RuntimeContext,
    slots: Readonly<Record<string, unknown>>,
): void {
    ctx.stateSlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        ctx.stateStore.set(key, value);
    }
}

/**
 * Advance every `state.series` ring once for a new close bar — append a
 * fresh `NaN` head so the prior committed head slides to index 1. Runs
 * BEFORE compute on close, so a slot first allocated mid-compute (already
 * holding its seeded head) is not present here and is not double-advanced.
 *
 * @since 0.9
 * @stable
 * @example
 *     // advanceSeriesSlots(ctx);
 *     const advanced = true;
 *     void advanced;
 */
export function advanceSeriesSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.seriesSlots.values()) {
        advanceSeriesSlot(slot);
    }
}

/**
 * Commit every `state.series` live head as its bar-close value after
 * close compute, so the next advance retains it and a tick can reset to
 * it.
 *
 * @since 0.9
 * @stable
 * @example
 *     // commitSeriesSlots(ctx);
 *     const committed = true;
 *     void committed;
 */
export function commitSeriesSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.seriesSlots.values()) {
        commitSeriesSlot(slot);
    }
}

/**
 * Reset every `state.series` live head to its last committed value before
 * tick compute, so a re-write refines from the committed baseline and a
 * tick without a write reads the committed head. Does NOT advance length.
 *
 * @since 0.9
 * @stable
 * @example
 *     // resetSeriesHeads(ctx);
 *     const reset = true;
 *     void reset;
 */
export function resetSeriesHeads(ctx: RuntimeContext): void {
    for (const slot of ctx.seriesSlots.values()) {
        resetSeriesSlotHead(slot);
    }
}

/**
 * Roll every `state.array` slot's tentative ring back to its committed ring
 * before tick compute, so a head-replacing tick discards in-progress pushes
 * (and a tick without a push reads the committed collection). Runs once per
 * tick, before compute, next to {@link resetSeriesHeads}. There is no advance —
 * the array changes only when the author pushes.
 *
 * @since 1.3
 * @stable
 * @example
 *     // resetTentativeArraySlots(ctx);
 *     const reset = true;
 *     void reset;
 */
export function resetTentativeArraySlots(ctx: RuntimeContext): void {
    for (const slot of ctx.arraySlots.values()) {
        slot.onBarTick();
    }
}

/**
 * Commit every `state.array` slot's tentative ring into its committed ring
 * after close compute, so the next tick can roll back to it. Runs once per
 * close, after compute, next to {@link commitSeriesSlots}.
 *
 * @since 1.3
 * @stable
 * @example
 *     // commitArraySlots(ctx);
 *     const committed = true;
 *     void committed;
 */
export function commitArraySlots(ctx: RuntimeContext): void {
    for (const slot of ctx.arraySlots.values()) {
        slot.onBarClose();
    }
}

/**
 * Roll every `state.map` slot's tentative map back to its committed map before
 * tick compute, so a head-replacing tick discards in-progress writes (and a tick
 * without a write reads the committed collection). Runs once per tick, before
 * compute, next to {@link resetTentativeArraySlots}.
 *
 * @since 1.4
 * @stable
 * @example
 *     // resetTentativeMapSlots(ctx);
 *     const reset = true;
 *     void reset;
 */
export function resetTentativeMapSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.mapSlots.values()) {
        slot.onBarTick();
    }
}

/**
 * Commit every `state.map` slot's tentative map into its committed map after
 * close compute, so the next tick can roll back to it. Runs once per close,
 * after compute, next to {@link commitArraySlots}.
 *
 * @since 1.4
 * @stable
 * @example
 *     // commitMapSlots(ctx);
 *     const committed = true;
 *     void committed;
 */
export function commitMapSlots(ctx: RuntimeContext): void {
    for (const slot of ctx.mapSlots.values()) {
        slot.onBarClose();
    }
}
