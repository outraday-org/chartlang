// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MaxDrawingsIR, ScriptScaffold } from "../transform/ir.js";

// The `maxDrawings` buckets in a fixed emission order so the literal is
// deterministic regardless of which buckets the transform populated.
const BUCKET_ORDER: ReadonlyArray<keyof MaxDrawingsIR> = [
    "lines",
    "labels",
    "boxes",
    "polylines",
    "other",
];

/**
 * Emit the `maxDrawings: { … }` object-literal lines for a converted
 * scaffold, or `null` when no bucket is set (the property is omitted so the
 * adapter's default cap applies). When ANY bucket is populated, ALL five are
 * emitted in a fixed order — core's `DrawingCounts` is a total 5-bag budget,
 * so a partial literal is a type error at compile time; unset buckets default
 * to `0`. Iteration is not over the IR object's key order so the output stays
 * deterministic.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitMaxDrawings } from "./emitMaxDrawings.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitMaxDrawings(scaffold); // ["maxDrawings: {", "lines: 20,", …, "},"] | null
 */
export function emitMaxDrawings(scaffold: ScriptScaffold): string[] | null {
    const hasAny = BUCKET_ORDER.some((bucket) => scaffold.maxDrawings[bucket] !== undefined);
    if (!hasAny) {
        return null;
    }
    const entries = BUCKET_ORDER.map(
        (bucket) => `${bucket}: ${scaffold.maxDrawings[bucket] ?? 0},`,
    );
    return ["maxDrawings: {", ...entries, "},"];
}
