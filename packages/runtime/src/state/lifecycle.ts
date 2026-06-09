// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RuntimeContext } from "../runtimeContext";

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
 * @experimental
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
 * @experimental
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
