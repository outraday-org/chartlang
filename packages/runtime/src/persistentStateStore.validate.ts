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

// The captured cursor: an integer bar index, or the `-1` sentinel for a
// snapshot taken before any bar closed.
function isBarIndex(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= -1;
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

function isSlotsRecord(value: unknown): boolean {
    return isRecord(value) && Object.values(value).every((entry) => isJsonValue(entry));
}

// A per-runner nominal `order.*` position: finite signed `size`, an average of
// nominal prices that is finite or an explicit `null`, and the bar the position
// opened (or `null` when flat).
function isOrderPosition(value: unknown): boolean {
    if (!isRecord(value)) return false;
    if (!isSnapshotNumber(value.size)) return false;
    if (value.avgPrice !== null && !isSnapshotNumber(value.avgPrice)) return false;
    return value.entryBar === null || isBarIndex(value.entryBar);
}

function isRunnerSnapshot(value: unknown): boolean {
    if (!isRecord(value)) return false;
    if (!isSlotsRecord(value.slots)) return false;
    // Optional-additive, like the `siblings?` / `dependencies?` sections: absent
    // means the flat position, so a pre-orders payload validates unchanged.
    return value.orderPosition === undefined || isOrderPosition(value.orderPosition);
}

function isRunnerSnapshotMap(value: unknown): boolean {
    return isRecord(value) && Object.values(value).every((entry) => isRunnerSnapshot(entry));
}

/**
 * Validate a PLAN §6.9 persistent state snapshot before restore/save.
 *
 * Only `snapshotVersion: 2` is accepted. Version-1 payloads predate the
 * required `barIndex` field and are rejected outright (no migration): a
 * rejected snapshot means the host replays from scratch, which is what a
 * rejection has always meant. `barIndex` must be an integer `>= -1`, the
 * `-1` sentinel meaning "captured before any bar closed".
 *
 * Accepts two shapes:
 *
 * - **Legacy flat shape** (pre-0.7): `slots: Record<string, JsonValue>`
 *   carries every primary-runner slot — both `state.*` and `ta.*`. Loaded
 *   into the primary runner; dep / sibling sections default to absent.
 * - **Structured shape** (0.7+): `primary.slots` is required.
 *   `siblings[exportName].slots` and `dependencies[localId].slots`
 *   are optional; each section is independently restored into its
 *   matching runner. Each section's `orderPosition` is optional too and
 *   **absence means the flat position** — the additive field that let the
 *   `orders` channel ride without a version bump.
 *
 * @since 0.5 — widened in 0.7 to accept structured per-runner sections,
 *   `orderPosition` accepted in 1.11.
 * @internal
 * @stable
 * @example
 *     // import { validateSnapshot }
 *     //     from "@invinite-org/chartlang-runtime/internal";
 *     // validateSnapshot(snapshot); // true when the shape is JSON-clean
 */
export function validateSnapshot(snap: unknown): snap is StateSnapshot {
    if (!isRecord(snap)) return false;
    if (snap.snapshotVersion !== 2) return false;
    if (!isBarIndex(snap.barIndex)) return false;
    if (!isSnapshotNumber(snap.lastBarTime) || !isSnapshotNumber(snap.savedAt)) return false;
    if (!isRecord(snap.streams)) return false;
    if (!Object.values(snap.streams).every((stream) => isStreamSnapshot(stream))) return false;

    if ("primary" in snap) {
        if (!isRunnerSnapshot(snap.primary)) return false;
        if (snap.siblings !== undefined && !isRunnerSnapshotMap(snap.siblings)) return false;
        if (snap.dependencies !== undefined && !isRunnerSnapshotMap(snap.dependencies)) {
            return false;
        }
        return true;
    }

    return isSlotsRecord(snap.slots);
}
