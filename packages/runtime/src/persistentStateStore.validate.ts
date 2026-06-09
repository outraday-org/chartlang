// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue, StateSnapshot, StreamSnapshot } from "@invinite-org/chartlang-core";

const bufferKeys = ["time", "open", "high", "low", "close", "volume"] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
    if (value === null) return true;
    if (typeof value === "string" || typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
    if (isRecord(value)) {
        return Object.values(value).every((entry) => isJsonValue(entry));
    }
    return false;
}

function isSnapshotNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isBufferArray(value: unknown): value is ReadonlyArray<number | null> {
    return (
        Array.isArray(value) && value.every((entry) => entry === null || isSnapshotNumber(entry))
    );
}

function isStreamSnapshot(value: unknown): value is StreamSnapshot {
    if (!isRecord(value)) return false;
    if (typeof value.interval !== "string") return false;
    if (!Number.isInteger(value.headIndex) || !Number.isInteger(value.filled)) return false;
    const buffers = value.buffers;
    if (!isRecord(buffers)) return false;
    return bufferKeys.every((key) => isBufferArray(buffers[key]));
}

/**
 * Validate a PLAN §6.9 persistent state snapshot before restore/save.
 *
 * @since 0.5
 * @internal
 * @experimental
 * @example
 *     // import { validateSnapshot }
 *     //     from "@invinite-org/chartlang-runtime/internal";
 *     // validateSnapshot(snapshot); // true when the shape is JSON-clean
 */
export function validateSnapshot(snap: unknown): snap is StateSnapshot {
    if (!isRecord(snap)) return false;
    if (snap.snapshotVersion !== 1) return false;
    if (!isSnapshotNumber(snap.lastBarTime) || !isSnapshotNumber(snap.savedAt)) return false;
    if (!isRecord(snap.streams) || !isRecord(snap.slots)) return false;
    if (!Object.values(snap.streams).every((stream) => isStreamSnapshot(stream))) return false;
    return Object.values(snap.slots).every((slot) => isJsonValue(slot));
}
