// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";

/** Base docs URL; the per-code anchor is appended as `#<short-code>`. */
const DOCS_BASE = "https://chartlang.dev/converter/diagnostics";

/**
 * The trailing path segment of a full diagnostic code — the kebab-case slug
 * used as the in-text label and the docs anchor. `pine-converter/transform/
 * cap-mismatch` → `cap-mismatch`. A code with no `/` is returned as-is.
 *
 * The single source of truth for the slug: the docs generator
 * (`scripts/gen-converter-docs.ts`) and the site linter
 * (`apps/site/.../converterLint.ts`) both import this so a `#<slug>` docs
 * anchor never drifts from the CLI's rendered label.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { shortCode } from "./format.js";
 *     shortCode("pine-converter/transform/cap-mismatch"); // "cap-mismatch"
 */
export function shortCode(code: string): string {
    const lastSlash = code.lastIndexOf("/");
    return lastSlash === -1 ? code : code.slice(lastSlash + 1);
}

/** Left-pad a gutter line number to a fixed width. */
function gutter(lineNumber: number, width: number): string {
    return String(lineNumber).padStart(width, " ");
}

/** A run of `^` of at least length 1, marking a span extent on one line. */
function caret(length: number): string {
    return "^".repeat(Math.max(1, length));
}

/**
 * Render one {@link Diagnostic} to a multi-line, `rustc`/`tsc`-style block: a
 * `severity[short-code]: message` header, a `--> :line:col` locator, the
 * offending source line with a `^^^` underline of the span extent, and
 * trailing `= suggestion:` / `= docs:` lines. For a multi-line span the start
 * line is underlined from the start column, an `...` elision line follows, and
 * the end line is underlined up to the end column. `source` is the original
 * Pine input; lines are addressed 1-based to match {@link Diagnostic.span}.
 *
 * @since 0.1
 * @stable
 * @example
 *     const text = formatDiagnostic(
 *         {
 *             code: "pine-converter/transform/cross-collection-linefill",
 *             severity: "error",
 *             message: "linefill across two collections has no analogue",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 8 },
 *         },
 *         "linefill.new(a, b)\n",
 *     );
 *     text.startsWith("error[cross-collection-linefill]:"); // true
 */
export function formatDiagnostic(diagnostic: Diagnostic, source: string): string {
    const { severity, code, message, span, suggestion } = diagnostic;
    const slug = shortCode(code);
    const lines = source.split(/\r?\n/);
    const gutterWidth = String(span.endLine).length;
    const pad = " ".repeat(gutterWidth);

    const out: string[] = [];
    out.push(`${severity}[${slug}]: ${message}`);
    out.push(`${pad} --> :${span.startLine}:${span.startColumn}`);
    out.push(`${pad} |`);

    const startSrc = lines[span.startLine - 1] ?? "";
    if (span.startLine === span.endLine) {
        out.push(`${gutter(span.startLine, gutterWidth)} | ${startSrc}`);
        const underlineLength = Math.max(1, span.endColumn - span.startColumn);
        out.push(`${pad} | ${" ".repeat(span.startColumn - 1)}${caret(underlineLength)} here`);
    } else {
        const endSrc = lines[span.endLine - 1] ?? "";
        const startUnderline = Math.max(1, startSrc.length - (span.startColumn - 1));
        out.push(`${gutter(span.startLine, gutterWidth)} | ${startSrc}`);
        out.push(`${pad} | ${" ".repeat(span.startColumn - 1)}${caret(startUnderline)}`);
        out.push(`${pad} ...`);
        out.push(`${gutter(span.endLine, gutterWidth)} | ${endSrc}`);
        out.push(`${pad} | ${caret(Math.max(1, span.endColumn - 1))} here`);
    }

    if (suggestion !== undefined) {
        out.push(`${pad} = suggestion: ${suggestion}`);
    }
    out.push(`${pad} = docs: ${DOCS_BASE}#${slug}`);
    return out.join("\n");
}
