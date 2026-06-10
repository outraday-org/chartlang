// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableSlot } from "./mutableSlot.js";

const sentinel = (name: string): never => {
    throw new Error(`${name} called outside an active script step`);
};

/**
 * Persistent state slots, Pine `var` semantics. Writes during a tick are
 * tentative and discarded if a later tick replaces the head bar; on bar
 * close the tentative value commits. Reads return the active tentative
 * value for the current step.
 *
 * The runtime replaces this compile-time callable hole with a slot-aware
 * namespace through `ComputeContext.state`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns: typeof state = state;
 *     void ns;
 */
export const state = Object.freeze({
    /**
     * Allocate or read a persistent number slot.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof state.float = state.float;
     *     void fn;
     */
    float(_init: number): MutableSlot<number> {
        return sentinel("state.float");
    },

    /**
     * Allocate or read a persistent integer slot.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof state.int = state.int;
     *     void fn;
     */
    int(_init: number): MutableSlot<number> {
        return sentinel("state.int");
    },

    /**
     * Allocate or read a persistent boolean slot.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof state.bool = state.bool;
     *     void fn;
     */
    bool(_init: boolean): MutableSlot<boolean> {
        return sentinel("state.bool");
    },

    /**
     * Allocate or read a persistent string slot.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof state.string = state.string;
     *     void fn;
     */
    string(_init: string): MutableSlot<string> {
        return sentinel("state.string");
    },

    /**
     * Tick-persistent state slots, Pine `varip` semantics. Writes commit
     * immediately, even during a tick.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fn: typeof state.tick.float = state.tick.float;
     *     void fn;
     */
    tick: Object.freeze({
        float(_init: number): MutableSlot<number> {
            return sentinel("state.tick.float");
        },
        int(_init: number): MutableSlot<number> {
            return sentinel("state.tick.int");
        },
        bool(_init: boolean): MutableSlot<boolean> {
            return sentinel("state.tick.bool");
        },
        string(_init: string): MutableSlot<string> {
            return sentinel("state.tick.string");
        },
    }),
});

/**
 * Static type of the `state` namespace. Runtime implementations satisfy
 * this shape structurally when they are installed on `ComputeContext.state`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns: StateNamespace = state;
 *     void ns;
 */
export type StateNamespace = typeof state;
