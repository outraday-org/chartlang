// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "@invinite-org/chartlang-core";

function snapshotUnknown(value: unknown): unknown {
    if (Array.isArray(value)) {
        return Object.freeze(value.map((item) => snapshotUnknown(item)));
    }
    if (typeof value === "object" && value !== null) {
        return Object.freeze(
            Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, snapshotUnknown(item)]),
            ),
        );
    }
    return value;
}

/**
 * Deep-clone a `meta` bag at emission time and freeze every level.
 *
 * The single snapshot helper for every emission channel that carries author
 * `meta` — `alert`, `runtime.log.*`, and `order.*`. The clone is what makes an
 * emission independent of the author's object: a script may mutate (or a proxy
 * may revoke) the bag it passed after the call returns and the queued emission
 * is unaffected. The freeze is what stops a consumer from mutating an emission
 * it was handed.
 *
 * Every nested object is rebuilt rather than passed through, including
 * non-plain ones, so nothing with a live prototype or a trap can ride the wire.
 * `emitLog` additionally rejects non-plain meta before it gets here; `alert`
 * and `order` let `validateEmission` be the arbiter downstream.
 *
 * @since 1.11
 * @example
 *     // import { snapshotMeta } from "./snapshotMeta.js";
 *     // const frozen = snapshotMeta({ reason: "crossover", legs: [1, 2] });
 *     // Object.isFrozen(frozen); // true
 */
export function snapshotMeta(
    meta: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
    return snapshotUnknown(meta) as Readonly<Record<string, JsonValue>>;
}
