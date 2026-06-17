// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScanResult } from "./numeric.js";
import type { LexerDiagnostic, Token } from "./tokens.js";

function decodeEscape(source: string, i: number): { value: string; next: number } {
    const ch = source[i + 1];
    switch (ch) {
        case "n":
            return { value: "\n", next: i + 2 };
        case "t":
            return { value: "\t", next: i + 2 };
        case "\\":
            return { value: "\\", next: i + 2 };
        case "'":
            return { value: "'", next: i + 2 };
        case '"':
            return { value: '"', next: i + 2 };
        case "x": {
            const hex = source.slice(i + 2, i + 4);
            const code = Number.parseInt(hex, 16);
            if (hex.length === 2 && Number.isFinite(code)) {
                return { value: String.fromCharCode(code), next: i + 4 };
            }
            return { value: "x", next: i + 2 };
        }
        case "u": {
            const hex = source.slice(i + 2, i + 6);
            const code = Number.parseInt(hex, 16);
            if (hex.length === 4 && Number.isFinite(code)) {
                return { value: String.fromCharCode(code), next: i + 6 };
            }
            return { value: "u", next: i + 2 };
        }
        default:
            // Unknown escape: drop the backslash, keep the literal char
            // (matches Pine's permissive escape handling).
            return { value: ch ?? "", next: i + 2 };
    }
}

/**
 * Scan a quoted string literal starting at `start` (the opening quote).
 * Both `'` and `"` styles are accepted; the closing quote must match the
 * opener. Recognized escapes: `\n \t \\ \' \" \xNN \uNNNN`. A string that
 * reaches end-of-line or end-of-input before its closing quote yields an
 * `unterminated-string` diagnostic with the bytes captured so far.
 *
 * @since 0.1
 * @experimental
 * @example
 *     scanString("'hi'", 0, 1, 1).token.stringValue; // "hi"
 */
export function scanString(
    source: string,
    start: number,
    line: number,
    column: number,
): ScanResult {
    const quote = source[start];
    let i = start + 1;
    let value = "";
    const diagnostics: LexerDiagnostic[] = [];
    while (i < source.length) {
        const ch = source[i];
        if (ch === "\n") {
            break;
        }
        if (ch === "\\") {
            const decoded = decodeEscape(source, i);
            value += decoded.value;
            i = decoded.next;
            continue;
        }
        if (ch === quote) {
            i += 1;
            const span = {
                startLine: line,
                startColumn: column,
                endLine: line,
                endColumn: column + (i - start),
            } as const;
            const token: Token = {
                kind: "string",
                text: source.slice(start, i),
                span,
                stringValue: value,
            };
            return { token, diagnostics, end: i };
        }
        value += ch;
        i += 1;
    }
    const span = {
        startLine: line,
        startColumn: column,
        endLine: line,
        endColumn: column + (i - start),
    } as const;
    diagnostics.push({
        code: "pine-converter/lex/unterminated-string",
        severity: "error",
        message: "Unterminated string literal.",
        span,
    });
    const token: Token = {
        kind: "string",
        text: source.slice(start, i),
        span,
        stringValue: value,
    };
    return { token, diagnostics, end: i };
}
