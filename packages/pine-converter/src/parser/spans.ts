// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SourceSpan } from "../index.js";

/**
 * Compose a parent {@link SourceSpan} that exactly covers `start` through
 * `end` — the start of `start` to the end of `end`. The parser uses this to
 * build node spans from their first and last child spans so the
 * span-containment invariant (every node ⊆ its parent) holds by
 * construction.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const a = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 3 };
 *     const b = { startLine: 1, startColumn: 5, endLine: 1, endColumn: 9 };
 *     spanBetween(a, b); // { startLine: 1, startColumn: 1, endLine: 1, endColumn: 9 }
 */
export function spanBetween(start: SourceSpan, end: SourceSpan): SourceSpan {
    return {
        startLine: start.startLine,
        startColumn: start.startColumn,
        endLine: end.endLine,
        endColumn: end.endColumn,
    };
}
