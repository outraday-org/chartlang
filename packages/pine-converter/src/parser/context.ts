// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";
import type { Token } from "../lexer/index.js";
import { createCursor, type TokenCursor } from "./cursor.js";

/**
 * Mutable parsing context threaded through the declaration and statement
 * parsers: the comment-skipping {@link TokenCursor}, an `addDiagnostic`
 * sink, and `peekAhead(n)` for the small fixed lookahead the grammar needs
 * (distinguishing `name = expr` named arguments from positional ones, and a
 * `for ... in` head from `for i = ...`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx = createContext(lex("//@version=6\n").tokens);
 *     ctx.cursor.peekKind(); // "version-directive"
 */
export type ParserContext = Readonly<{
    cursor: TokenCursor;
    addDiagnostic: (diagnostic: Diagnostic) => void;
    /** The significant token `n` positions ahead of the cursor (comments skipped); `eof` past the end. */
    peekAhead: (n: number) => Token;
    diagnostics: readonly Diagnostic[];
}>;

/**
 * Build a fresh {@link ParserContext} over a lexer token stream. The array
 * must end with the lexer's trailing `eof` token.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ctx = createContext(lex("indicator()\n").tokens);
 *     ctx.peekAhead(0).text; // "indicator"
 */
export function createContext(tokens: readonly Token[]): ParserContext {
    const diagnostics: Diagnostic[] = [];
    const cursor = createCursor(tokens);

    return {
        cursor,
        addDiagnostic: (diagnostic) => {
            diagnostics.push(diagnostic);
        },
        peekAhead: (n) => cursor.peekAhead(n),
        get diagnostics() {
            return diagnostics;
        },
    };
}
