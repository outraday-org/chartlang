// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LexerDiagnostic, Token } from "./tokens.js";

/**
 * Outcome of scanning one literal: the produced {@link Token}, any
 * diagnostics raised, and `end` — the source index immediately after the
 * consumed characters (the scanner's resume point).
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: ScanResult = {
 *         token: {
 *             kind: "int",
 *             text: "1",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *             numericValue: 1,
 *         },
 *         diagnostics: [],
 *         end: 1,
 *     };
 *     void r;
 */
export type ScanResult = Readonly<{
    token: Token;
    diagnostics: readonly LexerDiagnostic[];
    end: number;
}>;

function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
}

function isHexDigit(ch: string): boolean {
    return isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}

/**
 * Scan a numeric literal beginning at `start` (a digit or a `.` followed
 * by a digit). Recognizes ints with `_` separators, floats (`1.5`, `.5`,
 * `1.`, scientific `1e3`/`1.5e-2`), and hex (`0xDEAD`). Malformed inputs
 * (`1.2.3`, `1e`, `0x`) yield a `malformed-numeric` diagnostic and a
 * token flagged `malformed` with `numericValue: NaN`.
 *
 * @since 0.1
 * @stable
 * @example
 *     scanNumeric("1_000", 0, 1, 1).token.numericValue; // 1000
 */
export function scanNumeric(
    source: string,
    start: number,
    line: number,
    column: number,
): ScanResult {
    let i = start;
    let isFloat = false;
    let malformed = false;

    if (source[i] === "0" && (source[i + 1] === "x" || source[i + 1] === "X")) {
        i += 2;
        const hexStart = i;
        while (i < source.length && (isHexDigit(source[i]) || source[i] === "_")) {
            i += 1;
        }
        if (i === hexStart) {
            malformed = true;
        }
        return finish(source, start, i, line, column, false, malformed);
    }

    while (i < source.length && (isDigit(source[i]) || source[i] === "_")) {
        i += 1;
    }
    if (source[i] === ".") {
        isFloat = true;
        i += 1;
        while (i < source.length && (isDigit(source[i]) || source[i] === "_")) {
            i += 1;
        }
    }
    if (source[i] === "e" || source[i] === "E") {
        isFloat = true;
        i += 1;
        if (source[i] === "+" || source[i] === "-") {
            i += 1;
        }
        const expStart = i;
        while (i < source.length && isDigit(source[i])) {
            i += 1;
        }
        if (i === expStart) {
            malformed = true;
        }
    }
    // A trailing `.` (e.g. the second dot in `1.2.3`) means a malformed,
    // multi-dot literal — consume the run of dots/digits so the parser
    // restarts cleanly past the whole bad token.
    if (source[i] === ".") {
        malformed = true;
        while (i < source.length && (source[i] === "." || isDigit(source[i]))) {
            i += 1;
        }
    }
    return finish(source, start, i, line, column, isFloat, malformed);
}

function finish(
    source: string,
    start: number,
    end: number,
    line: number,
    column: number,
    isFloat: boolean,
    malformed: boolean,
): ScanResult {
    const text = source.slice(start, end);
    const span = {
        startLine: line,
        startColumn: column,
        endLine: line,
        endColumn: column + (end - start),
    } as const;
    if (malformed) {
        const token: Token = {
            kind: isFloat ? "float" : "int",
            text,
            span,
            numericValue: Number.NaN,
            malformed: true,
        };
        return {
            token,
            diagnostics: [
                {
                    code: "pine-converter/lex/malformed-numeric",
                    severity: "error",
                    message: `Malformed numeric literal "${text}".`,
                    span,
                },
            ],
            end,
        };
    }
    const cleaned = text.replace(/_/g, "");
    const numericValue = isFloat ? Number.parseFloat(cleaned) : Number(cleaned);
    return {
        token: { kind: isFloat ? "float" : "int", text, span, numericValue },
        diagnostics: [],
        end,
    };
}
