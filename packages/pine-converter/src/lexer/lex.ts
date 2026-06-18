// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createIndentTracker } from "./indent.js";
import { PINE_V6_KEYWORDS } from "./keywords.js";
import { scanNumeric } from "./numeric.js";
import { scanString } from "./string.js";
import type { LexResult, LexerDiagnostic, Token, TokenKind } from "./tokens.js";

// Multi-character operators are matched longest-first so `==` never lexes
// as two `=` and `:=`/`=>` stay intact.
const OPERATORS: readonly string[] = [
    "==",
    "!=",
    "<=",
    ">=",
    ":=",
    "=>",
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

    function push(token: Token): void {
        tokens.push(token);
        if (token.kind !== "comment" && token.kind !== "version-directive") {
            lastSignificant = token;
        }
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

    function emitIndentation(lineStart: number): void {
        if (isBlankOrCommentLine(lineStart)) {
            return;
        }
        const { width, mixed } = measureIndent(lineStart);
        if (mixed && !sawMixedIndent) {
            sawMixedIndent = true;
            diagnostics.push({
                code: "pine-converter/lex/mixed-indent",
                severity: "warning",
                message: "Mixed tabs and spaces in indentation; tabs counted as 4 spaces.",
                span: spanAt(line, 1, width),
            });
        }
        const resolution = indent.resolve(width);
        const delta = resolution.delta;
        if (resolution.inconsistentDedent) {
            diagnostics.push({
                code: "pine-converter/lex/inconsistent-dedent",
                severity: "warning",
                message: "Dedent does not match any enclosing indentation level.",
                span: spanAt(line, 1, width),
            });
        }
        if (delta.kind === "indent") {
            push({ kind: "indent", text: "", span: spanAt(line, 1, 0) });
        } else if (delta.kind === "dedent") {
            for (let d = 0; d < delta.dedentCount; d += 1) {
                push({ kind: "dedent", text: "", span: spanAt(line, 1, 0) });
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
        push({ kind: "newline", text: "\n", span: spanAt(startLine, startColumn, 1) });
        emitIndentation(physicalNewlineEnd);
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
