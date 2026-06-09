// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot } from "@invinite-org/chartlang-core";

/**
 * Optional PLAN §6.9 state-slot marshal hooks. Phase-4 `state.*`
 * primitives use the identity default because their values are already
 * JSON-clean; future primitives with typed-array internals can provide
 * explicit hooks.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const hooks: StateSlotSerialisers<number> = {
 *         serialiseState: (value) => value,
 *         deserialiseState: (value) => Number(value),
 *     };
 *     void hooks;
 */
export type StateSlotSerialisers<T> = {
    readonly serialiseState?: (value: T) => unknown;
    readonly deserialiseState?: (value: unknown) => T;
};

/**
 * Internal runtime slot behind script-facing {@link MutableSlot}
 * proxies. `tickPersistent: true` models `state.tick.*`, whose writes
 * commit immediately; `false` models `state.*`, whose writes remain
 * tentative until bar close.
 *
 * @since 0.4
 * @stable
 * @example
 *     const slot = new StateSlot(0, false);
 *     slot.set(5);
 *     slot.onBarClose();
 *     const pair = { committed: slot.committed, tentative: slot.tentative };
 *     void pair;
 */
export class StateSlot<T> {
    committed: T;
    tentative: T;

    constructor(
        init: T,
        public readonly tickPersistent: boolean,
        private readonly serialisers: StateSlotSerialisers<T> = {},
    ) {
        this.committed = init;
        this.tentative = init;
    }

    get(): T {
        return this.tickPersistent ? this.committed : this.tentative;
    }

    set(value: T): void {
        if (this.tickPersistent) {
            this.committed = value;
        } else {
            this.tentative = value;
        }
    }

    onBarClose(): void {
        if (!this.tickPersistent) {
            this.committed = this.tentative;
        }
    }

    onBarTick(): void {
        if (!this.tickPersistent) {
            this.tentative = this.committed;
        }
    }

    serialise(value: T): unknown {
        return this.serialisers.serialiseState?.(value) ?? value;
    }
}

/**
 * Build the script-facing mutable proxy for a runtime state slot.
 *
 * @since 0.4
 * @stable
 * @example
 *     const slot = asMutableSlot(new StateSlot(1, false));
 *     slot.value = 2;
 *     void slot.value;
 */
export function asMutableSlot<T>(slot: StateSlot<T>): MutableSlot<T> {
    return {
        get value(): T {
            return slot.get();
        },
        set value(value: T) {
            slot.set(value);
        },
    };
}
