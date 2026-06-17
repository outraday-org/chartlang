// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SourceSpan } from "../index.js";

/**
 * Mixin carried by every Pine AST node: a 1-based {@link SourceSpan}
 * locating the node in the original Pine source. Spans are nested — a
 * parent node's span always contains every child node's span (enforced by
 * the parser's `parse.property.test.ts`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const node: WithSpan = {
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
 *     };
 *     void node;
 */
export type WithSpan = Readonly<{
    span: SourceSpan;
}>;
