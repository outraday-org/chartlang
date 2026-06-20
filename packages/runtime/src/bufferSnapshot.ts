// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "./ringBuffer.js";

/**
 * JSON-clean snapshot shape of a {@link Float64RingBuffer} — the head
 * index, the filled count, and the raw cell values with non-finite cells
 * persisted as `null` (the snapshot validator rejects `NaN`). Shared by the
 * `ta.*` and `state.series` slot persistence paths.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const snap: BufferSnapshot = { headIndex: 0, filled: 1, values: [1] };
 */
export type BufferSnapshot = Readonly<{
    headIndex: number;
    filled: number;
    values: ReadonlyArray<number | null>;
}>;

/**
 * Narrow an `unknown` to a plain (non-array) object record. The first guard
 * every snapshot restore runs before reading named fields.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     isRecord({ a: 1 }); // true
 */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Narrow an `unknown` to a finite integer (used for `headIndex` / `filled`
 * snapshot fields).
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     isInteger(3); // true
 */
export function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

/**
 * Map a runtime number to its JSON-clean form: a finite number rides
 * through, any non-finite value (`NaN`, `±Infinity`) becomes `null` so the
 * snapshot validator accepts it.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     finiteOrNull(Number.NaN); // null
 */
export function finiteOrNull(value: number): number | null {
    return Number.isFinite(value) ? value : null;
}

/**
 * Inverse of {@link finiteOrNull} for restore: a persisted `null` rehydrates
 * to `NaN`, a finite number rides through, and anything else (a string, an
 * `Infinity` that slipped past serialise) fails to `null` so the caller can
 * reject the whole slot.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     restoreNumber(null); // NaN
 */
export function restoreNumber(value: unknown): number | null {
    if (value === null) return Number.NaN;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Validate that an `unknown` is a well-formed {@link BufferSnapshot}: integer
 * `headIndex` + `filled`, and a `values` array whose every cell is `null` or
 * a finite number.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     isBufferSnapshot({ headIndex: 0, filled: 0, values: [] }); // true
 */
export function isBufferSnapshot(value: unknown): value is BufferSnapshot {
    if (!isRecord(value)) return false;
    if (!isInteger(value.headIndex) || !isInteger(value.filled)) return false;
    return (
        Array.isArray(value.values) &&
        value.values.every(
            (entry) => entry === null || (typeof entry === "number" && Number.isFinite(entry)),
        )
    );
}

/**
 * Serialise a {@link Float64RingBuffer} into its JSON-clean
 * {@link BufferSnapshot} record.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const snap = serialiseBuffer(new Float64RingBuffer(8));
 */
export function serialiseBuffer(buffer: Float64RingBuffer): JsonValue {
    const snapshot = buffer.serialiseSnapshotBuffer();
    return {
        headIndex: snapshot.headIndex,
        filled: snapshot.filled,
        values: snapshot.values,
    };
}

/**
 * Rebuild a {@link Float64RingBuffer} of the given `capacity` from a
 * {@link BufferSnapshot}, returning `null` when the snapshot is incompatible
 * with the capacity (the underlying restore throws and is caught).
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const buf = restoreBuffer(snap, 8); // null on capacity mismatch
 */
export function restoreBuffer(
    snapshot: BufferSnapshot,
    capacity: number,
): Float64RingBuffer | null {
    const buffer = new Float64RingBuffer(capacity);
    try {
        buffer.restoreFromSnapshotBuffer(snapshot);
        return buffer;
    } catch {
        return null;
    }
}
