// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableArraySlot } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";

/**
 * Runtime slot behind a script-facing `state.array(capacity)` handle. Unlike
 * the scalar `StateSlot` (one committed/tentative *value*) or the `SeriesSlot`
 * (one ring advanced once per bar), this is a **bounded FIFO collection** with
 * two `Float64RingBuffer`s: `tentativeRing` holds the live, author-facing
 * pushes; `committedRing` is the bar-close snapshot a tick rolls back to.
 *
 * The committed/tentative discipline mirrors `StateSlot`: pushes during a tick
 * mutate the tentative ring; a head-bar-replacing tick resets it from committed
 * (in-progress pushes discarded); a bar close commits tentative into committed.
 * The two-ring copy is `O(capacity)` per tick via a typed-array
 * {@link Float64RingBuffer.copyFrom} memcpy — bounded because `capacity` is a
 * required compile-time literal (see `tasks/future/state-array/README.md`
 * Architecture Decisions: "Tick rollback = a two-ring buffer copy").
 *
 * @since 1.3
 * @stable
 * @example
 *     const slot = new ArrayStateSlot(4);
 *     slot.handle.push(1);
 *     slot.onBarClose();
 *     slot.handle.get(0); // 1
 */
export class ArrayStateSlot {
    readonly committedRing: Float64RingBuffer;
    readonly tentativeRing: Float64RingBuffer;
    readonly handle: MutableArraySlot<number>;

    constructor(public readonly capacity: number) {
        this.committedRing = new Float64RingBuffer(capacity);
        this.tentativeRing = new Float64RingBuffer(capacity);
        this.handle = buildArrayHandle(this);
    }

    /** Commit the tentative ring into the committed ring (bar close). */
    onBarClose(): void {
        this.committedRing.copyFrom(this.tentativeRing);
    }

    /** Roll the tentative ring back to the committed ring (head-replacing tick). */
    onBarTick(): void {
        this.tentativeRing.copyFrom(this.committedRing);
    }
}

/**
 * Build the identity-stable {@link MutableArraySlot} handle over an
 * {@link ArrayStateSlot}. All author-facing reads and writes route through the
 * **tentative** ring (mirroring `StateSlot.set`/`StateSlot.get`, which read and
 * write `tentative` for non-tick slots); the committed ring is the rollback
 * source. `get(out-of-range)` returns `NaN` (the ring's `at` contract), never
 * throws. A plain object with getters — no `Proxy` — because the handle has a
 * fixed method set and is deliberately not number-coercible.
 *
 * @since 1.3
 * @stable
 * @example
 *     // const handle = buildArrayHandle(new ArrayStateSlot(4));
 *     // handle.push(1);
 *     // handle.last(); // 1
 */
export function buildArrayHandle(slot: ArrayStateSlot): MutableArraySlot<number> {
    return {
        push(value: number): void {
            slot.tentativeRing.append(value);
        },
        get(n: number): number {
            return slot.tentativeRing.at(n);
        },
        last(): number {
            return slot.tentativeRing.at(0);
        },
        clear(): void {
            slot.tentativeRing.reset();
        },
        get size(): number {
            return slot.tentativeRing.length;
        },
        get capacity(): number {
            return slot.capacity;
        },
    };
}

/**
 * Allocate a fresh {@link ArrayStateSlot} — both rings empty (`size === 0`).
 * Unlike `state.float(init)` there is no seed value: an empty collection starts
 * empty.
 *
 * @since 1.3
 * @stable
 * @example
 *     // const slot = createArrayStateSlot(20);
 *     // slot.handle.size; // 0
 */
export function createArrayStateSlot(capacity: number): ArrayStateSlot {
    return new ArrayStateSlot(capacity);
}

/**
 * Rebuild an {@link ArrayStateSlot} from already-restored rings (snapshot
 * path). The handle identity is recreated — acceptable, same as
 * `state.series` / `ta.*` restore.
 *
 * @since 1.3
 * @stable
 * @example
 *     // const slot = restoreArrayStateSlot(committedRing, tentativeRing);
 *     // slot.handle.size;
 */
export function restoreArrayStateSlot(
    committedRing: Float64RingBuffer,
    tentativeRing: Float64RingBuffer,
): ArrayStateSlot {
    const slot = new ArrayStateSlot(committedRing.capacity);
    slot.committedRing.copyFrom(committedRing);
    slot.tentativeRing.copyFrom(tentativeRing);
    return slot;
}
