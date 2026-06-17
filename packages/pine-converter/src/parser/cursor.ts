// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Token, TokenKind } from "../lexer/index.js";

/**
 * A forward-only cursor over the lexer's token stream that transparently
 * skips `comment` tokens. The lexer guarantees a single trailing `eof`, so
 * {@link TokenCursor.peek} never runs off the end — it parks on `eof`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };
 *     const cursor = createCursor([
 *         { kind: "identifier", text: "x", span },
 *         { kind: "eof", text: "", span },
 *     ]);
 *     cursor.peek().text; // "x"
 */
export type TokenCursor = Readonly<{
    /** The current significant token (comments skipped); `eof` at the end. */
    peek: () => Token;
    /**
     * The significant token `n` positions ahead of the current one (comments
     * skipped throughout); the trailing `eof` once the lookahead runs past
     * the end. `peekAhead(0)` equals {@link TokenCursor.peek}.
     */
    peekAhead: (n: number) => Token;
    /** The kind of the current significant token. */
    peekKind: () => TokenKind;
    /** Return the current token and advance past it (never past `eof`). */
    next: () => Token;
    /** True once the cursor is parked on the trailing `eof`. */
    atEnd: () => boolean;
    /**
     * If the current token matches `kind` (and `text`, when given), consume
     * and return it; otherwise return `null` without advancing.
     */
    match: (kind: TokenKind, text?: string) => Token | null;
    /**
     * Consume the current token if it matches `kind` (and `text`); otherwise
     * return `null` without advancing. Unlike {@link TokenCursor.match} this
     * is the diagnostic-bearing variant used by callers that report on a
     * miss — the miss handling lives at the call site.
     */
    expect: (kind: TokenKind, text?: string) => Token | null;
    /**
     * Skip tokens until the current token's kind is in `stopKinds` or `eof`
     * is reached. Used for error recovery after a diagnostic.
     */
    recover: (stopKinds: ReadonlySet<TokenKind>) => void;
}>;

/**
 * Construct a {@link TokenCursor} over `tokens`. The array must end with the
 * lexer's trailing `eof` token (it always does).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const cursor = createCursor(lex("//@version=6").tokens);
 *     cursor.peekKind(); // "version-directive"
 */
export function createCursor(tokens: readonly Token[]): TokenCursor {
    let index = 0;

    function skipComments(): void {
        while (index < tokens.length && tokens[index].kind === "comment") {
            index += 1;
        }
    }

    function current(): Token {
        skipComments();
        // The lexer always appends a single `eof`; once parked there, every
        // further `peek` returns it.
        return tokens[Math.min(index, tokens.length - 1)];
    }

    function peek(): Token {
        return current();
    }

    function peekAhead(n: number): Token {
        skipComments();
        let cursor = index;
        let remaining = n;
        while (remaining > 0 && cursor < tokens.length - 1) {
            cursor += 1;
            if (tokens[cursor].kind !== "comment") {
                remaining -= 1;
            }
        }
        return tokens[Math.min(cursor, tokens.length - 1)];
    }

    function peekKind(): TokenKind {
        return current().kind;
    }

    function atEnd(): boolean {
        return current().kind === "eof";
    }

    function next(): Token {
        const token = current();
        if (token.kind !== "eof") {
            index += 1;
        }
        return token;
    }

    function matches(token: Token, kind: TokenKind, text?: string): boolean {
        return token.kind === kind && (text === undefined || token.text === text);
    }

    function match(kind: TokenKind, text?: string): Token | null {
        const token = current();
        if (matches(token, kind, text)) {
            return next();
        }
        return null;
    }

    function expect(kind: TokenKind, text?: string): Token | null {
        return match(kind, text);
    }

    function recover(stopKinds: ReadonlySet<TokenKind>): void {
        while (!atEnd() && !stopKinds.has(current().kind)) {
            index += 1;
        }
    }

    return { peek, peekAhead, peekKind, next, atEnd, match, expect, recover };
}
