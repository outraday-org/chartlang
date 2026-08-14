// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Typed failure of a host snapshot verb (`exportSnapshot` / `importSnapshot`).
 *
 * Distinct from a host `fatal`: a `SnapshotError` means the runner is alive
 * and the request was refused (called before `load`, called after the first
 * `push`, a `StateStoreKey` mismatch, or a malformed payload), so the caller
 * can fall back to a full replay instead of tearing the host down.
 *
 * @since 1.11
 * @stable
 * @example
 *     const err = new SnapshotError("importSnapshot: state store key mismatch");
 *     void err.name;
 */
export class SnapshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SnapshotError";
    }
}

/**
 * Structural {@link SnapshotError} guard.
 *
 * Deliberately name-based rather than `instanceof`: a host, its worker bundle,
 * and its consumer can each carry their own copy of `@invinite-org/chartlang-core`,
 * and an error crossing a worker / QuickJS membrane is rebuilt in the receiving
 * realm anyway. Matching on `name` keeps the classification true in all of
 * those cases.
 *
 * @since 1.11
 * @stable
 * @example
 *     const yes = isSnapshotError(new SnapshotError("nope"));
 *     void yes;
 */
export function isSnapshotError(value: unknown): value is SnapshotError {
    return value instanceof Error && value.name === "SnapshotError";
}
