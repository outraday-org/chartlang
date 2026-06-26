// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createIndentTracker, isContinuationLead } from "./indent.js";
import { PINE_V6_KEYWORDS } from "./keywords.js";
import { scanNumeric } from "./numeric.js";
import { scanString } from "./string.js";
import type { LexResult, LexerDiagnostic, Token, TokenKind } from "./tokens.js";

// Multi-character operators are matched longest-first so `==` never lexes
// as two `=`, `:=`/`=>` stay intact, and a compound assignment (`+=`) never
// splits into its arithmetic operator + `=`.
const OPERATORS: readonly string[] = [
    "==",
    "!=",
    "<=",
    ">=",
    ":=",
    "=>",
    "+=",
    "-=",
    "*=",
    "/=",
    "+",
    "-",
    "*",
    "/",
    "%",
    "<",
    ">",
    "?",
    ":",
    "=",
];

const PUNCTUATION: ReadonlySet<string> = new Set(["[", "]", "(", ")", "{", "}", ",", "."]);

const OPEN_BRACKETS: ReadonlySet<string> = new Set(["(", "[", "{"]);
const CLOSE_BRACKETS: ReadonlySet<string> = new Set([")", "]", "}"]);

// A `newline` whose emission is deferred until the next significant token is
// known (leading-operator line continuation). Bounded one-token buffering: the
// held newline is resolved by the very next significant token, never by
// arbitrary lookahead. `lineStart`/`atLine` describe the continuation line so
// a late flush still measures + spans it correctly.
type PendingNewline = Readonly<{ token: Token; lineStart: number; atLine: number }>;

function isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentPart(ch: string): boolean {
    return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}

function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
}

function isHexDigit(ch: string): boolean {
    return isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}

/**
 * Tokenize a Pine Script v6 source string into a {@link LexResult}.
 *
 * The token stream models Pine's significant indentation with synthetic
 * `newline`/`indent`/`dedent` tokens and always terminates with a single
 * `eof`. Malformed numerics, unterminated strings, illegal characters,
 * invalid colors, and inconsistent/mixed indentation surface as
 * {@link LexerDiagnostic}s rather than throwing.
 *
 * @since 0.1
 * @stable
 * @example
 *     const { tokens } = lex("//@version=6\nindicator('hi')");
 *     tokens[0]?.kind; // "version-directive"
 */
export function lex(source: string): LexResult {
    const tokens: Token[] = [];
    const diagnostics: LexerDiagnostic[] = [];
    const indent = createIndentTracker();

    let i = 0;
    let line = 1;
    let column = 1;
    let parenDepth = 0;
    // The last token that can hold a logical line open across a physical
    // newline (`,` or an unmatched open bracket).
    let lastSignificant: Token | undefined;
    let sawMixedIndent = false;
    // A held `newline` awaiting its next significant token (leading-operator
    // continuation). Resolved — dropped or flushed — by `resolvePending`.
    let pendingNewline: PendingNewline | undefined;

    function push(token: Token): void {
        // A pending newline is only ever set when the next token will be the
        // first significant token of a continuation line, so this token
        // resolves it (drop = continuation, or flush = real line break).
        // `flushPendingNewline` clears the pending state before its own
        // `push` calls, so the newline/indent/dedent it emits never re-enter.
        const pending = pendingNewline;
        if (pending !== undefined) {
            resolvePending(pending, token);
        }
        tokens.push(token);
        if (token.kind !== "comment" && token.kind !== "version-directive") {
            lastSignificant = token;
        }
    }

    function flushPendingNewline(): void {
        const pending = pendingNewline;
        if (pending === undefined) {
            return;
        }
        pendingNewline = undefined;
        push(pending.token);
        emitIndentation(pending.lineStart, pending.atLine);
    }

    function resolvePending(pending: PendingNewline, leadToken: Token): void {
        if (
            isContinuationLead(leadToken.kind, leadToken.text) &&
            measureIndent(pending.lineStart).width > indent.currentLevel()
        ) {
            // Leading-operator continuation: drop the held newline and leave
            // the indent stack untouched (no `resolve`, so no indent/dedent),
            // making the line transparent to block structure. The parser sees
            // one uninterrupted expression and the indent/dedent counts stay
            // balanced.
            pendingNewline = undefined;
            return;
        }
        flushPendingNewline();
    }

    function spanAt(startLine: number, startColumn: number, len: number) {
        return {
            startLine,
            startColumn,
            endLine: startLine,
            endColumn: startColumn + len,
        } as const;
    }

    /** Width of leading whitespace on the line starting at `from`. */
    function measureIndent(from: number): { width: number; mixed: boolean } {
        let j = from;
        let width = 0;
        let sawSpace = false;
        let sawTab = false;
        while (j < source.length && (source[j] === " " || source[j] === "\t")) {
            if (source[j] === "\t") {
                sawTab = true;
                width += 4;
            } else {
                sawSpace = true;
                width += 1;
            }
            j += 1;
        }
        return { width, mixed: sawSpace && sawTab };
    }

    /** True when the line starting at `from` is blank or comment-only. */
    function isBlankOrCommentLine(from: number): boolean {
        let j = from;
        while (j < source.length && (source[j] === " " || source[j] === "\t")) {
            j += 1;
        }
        if (j >= source.length || source[j] === "\n") {
            return true;
        }
        return source[j] === "/" && source[j + 1] === "/";
    }

    // Resolve the indentation of a real (non-continuation, non-blank) content
    // line against the level stack and emit any `indent`/`dedent`. Only ever
    // called via `flushPendingNewline`, which only holds non-blank lines —
    // blank/comment lines emit their newline directly in `scanNewline` and
    // never reach here. `atLine` is the continuation line's number, captured
    // at defer time so a late flush spans the right line.
    function emitIndentation(lineStart: number, atLine: number): void {
        const { width, mixed } = measureIndent(lineStart);
        if (mixed && !sawMixedIndent) {
            sawMixedIndent = true;
            diagnostics.push({
                code: "pine-converter/lex/mixed-indent",
                severity: "warning",
                message: "Mixed tabs and spaces in indentation; tabs counted as 4 spaces.",
                span: spanAt(atLine, 1, width),
            });
        }
        const resolution = indent.resolve(width);
        const delta = resolution.delta;
        if (resolution.inconsistentDedent) {
            diagnostics.push({
                code: "pine-converter/lex/inconsistent-dedent",
                severity: "warning",
                message: "Dedent does not match any enclosing indentation level.",
                span: spanAt(atLine, 1, width),
            });
        }
        if (delta.kind === "indent") {
            push({ kind: "indent", text: "", span: spanAt(atLine, 1, 0) });
        } else if (delta.kind === "dedent") {
            for (let d = 0; d < delta.dedentCount; d += 1) {
                push({ kind: "dedent", text: "", span: spanAt(atLine, 1, 0) });
            }
        }
    }

    function continuesLine(): boolean {
        if (parenDepth > 0) {
            return true;
        }
        return lastSignificant?.kind === "punctuation" && lastSignificant.text === ",";
    }

    function scanNewline(): void {
        const startLine = line;
        const startColumn = column;
        i += 1;
        const physicalNewlineEnd = i;
        line += 1;
        column = 1;
        if (continuesLine()) {
            return;
        }
        const newlineToken: Token = {
            kind: "newline",
            text: "\n",
            span: spanAt(startLine, startColumn, 1),
        };
        if (isBlankOrCommentLine(physicalNewlineEnd)) {
            // Blank/comment-only lines never continue an expression and never
            // touch the indent stack — emit the newline immediately, no defer.
            push(newlineToken);
            return;
        }
        // Defer the newline until the next significant token decides whether
        // this line is a leading-operator continuation (drop) or a real line
        // break (flush + resolve indentation).
        pendingNewline = { token: newlineToken, lineStart: physicalNewlineEnd, atLine: line };
    }

    function scanCommentOrDirective(): void {
        const startColumn = column;
        let j = i + 2;
        while (j < source.length && source[j] !== "\n") {
            j += 1;
        }
        const text = source.slice(i, j);
        const versionMatch = /^\/\/\s*@version\s*=\s*(\d+)/.exec(text);
        const span = spanAt(line, startColumn, j - i);
        if (versionMatch) {
            const versionNumber = Number(versionMatch[1]);
            push({ kind: "version-directive", text, span, versionNumber });
        } else {
            push({ kind: "comment", text, span });
        }
        column += j - i;
        i = j;
    }

    function scanColor(): void {
        const startColumn = column;
        let j = i + 1;
        while (j < source.length && isHexDigit(source[j])) {
            j += 1;
        }
        const hexLen = j - (i + 1);
        if (hexLen === 6 || hexLen === 8) {
            // A color literal cannot be glued to a trailing identifier char.
            const trailing = j < source.length ? source[j] : "";
            if (isIdentPart(trailing)) {
                const span = spanAt(line, startColumn, hexLen + 2);
                diagnostics.push({
                    code: "pine-converter/lex/invalid-color",
                    severity: "error",
                    message: "Color literal followed by an alphanumeric character.",
                    span,
                });
            }
            const text = source.slice(i, j);
            push({ kind: "color", text, span: spanAt(line, startColumn, j - i) });
            column += j - i;
            i = j;
            return;
        }
        const span = spanAt(line, startColumn, 1);
        diagnostics.push({
            code: "pine-converter/lex/invalid-color",
            severity: "error",
            message: "Malformed color literal; expected #RRGGBB or #RRGGBBAA.",
            span,
        });
        column += 1;
        i += 1;
    }

    function scanIdentifier(): void {
        const startColumn = column;
        let j = i + 1;
        while (j < source.length && isIdentPart(source[j])) {
            j += 1;
        }
        const text = source.slice(i, j);
        const kind: TokenKind = PINE_V6_KEYWORDS.has(text) ? "keyword" : "identifier";
        push({ kind, text, span: spanAt(line, startColumn, j - i) });
        column += j - i;
        i = j;
    }

    function adopt(result: { token: Token; diagnostics: readonly LexerDiagnostic[]; end: number }) {
        push(result.token);
        for (const d of result.diagnostics) {
            diagnostics.push(d);
        }
        column += result.end - i;
        i = result.end;
    }

    function scanOperatorOrPunctuation(): boolean {
        for (const op of OPERATORS) {
            if (source.startsWith(op, i)) {
                push({ kind: "operator", text: op, span: spanAt(line, column, op.length) });
                column += op.length;
                i += op.length;
                return true;
            }
        }
        const ch = source[i];
        if (PUNCTUATION.has(ch)) {
            if (OPEN_BRACKETS.has(ch)) {
                parenDepth += 1;
            } else if (CLOSE_BRACKETS.has(ch) && parenDepth > 0) {
                parenDepth -= 1;
            }
            push({ kind: "punctuation", text: ch, span: spanAt(line, column, 1) });
            column += 1;
            i += 1;
            return true;
        }
        return false;
    }

    while (i < source.length) {
        const ch = source[i];
        if (ch === "\n") {
            scanNewline();
            continue;
        }
        if (ch === " " || ch === "\t" || ch === "\r") {
            column += 1;
            i += 1;
            continue;
        }
        if (ch === "/" && source[i + 1] === "/") {
            scanCommentOrDirective();
            continue;
        }
        if (ch === "#") {
            scanColor();
            continue;
        }
        if (ch === '"' || ch === "'") {
            adopt(scanString(source, i, line, column));
            continue;
        }
        if (isDigit(ch) || (ch === "." && i + 1 < source.length && isDigit(source[i + 1]))) {
            adopt(scanNumeric(source, i, line, column));
            continue;
        }
        if (isIdentStart(ch)) {
            scanIdentifier();
            continue;
        }
        if (scanOperatorOrPunctuation()) {
            continue;
        }
        diagnostics.push({
            code: "pine-converter/lex/illegal-character",
            severity: "error",
            message: `Illegal character ${JSON.stringify(ch)}.`,
            span: spanAt(line, column, 1),
        });
        column += 1;
        i += 1;
    }

    // A newline can still be pending if the deferred continuation line never
    // produced a significant token (e.g. it held only an illegal character).
    // Flush it so the held newline + its indentation are never lost.
    flushPendingNewline();
    // Trailing NEWLINE before EOF when the final physical line carried content.
    if (lastSignificant !== undefined && lastSignificant.kind !== "newline") {
        push({ kind: "newline", text: "", span: spanAt(line, column, 0) });
    }
    const remainingDedents = indent.dedentToZero();
    for (let d = 0; d < remainingDedents; d += 1) {
        tokens.push({ kind: "dedent", text: "", span: spanAt(line, column, 0) });
    }
    tokens.push({ kind: "eof", text: "", span: spanAt(line, column, 0) });

    return { tokens, diagnostics };
}
