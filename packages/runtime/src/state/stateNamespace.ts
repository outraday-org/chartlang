// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot, StateNamespace } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { asMutableSlot, StateSlot } from "./stateSlot.js";

type StoredStateSlot<T> = {
    readonly committed: T;
    readonly tentative: T;
};

const stateKey = (slotId: string): string => `${slotId}:state`;

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
    const key = stateKey(slotId);
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
