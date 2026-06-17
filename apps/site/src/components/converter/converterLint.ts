// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Maps the converter's structured `Diagnostic[]` (1-based source spans
// over the Pine input) onto CodeMirror lint diagnostics (0-based document
// offsets) so they render as inline squigglies on the input editor. The
// 1-based → 0-based conversion is centralised here (the one off-by-one
// risk flagged in the plan) and reused by the input pane's linter source.

import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import type { Diagnostic } from "@invinite-org/chartlang-pine-converter";
// The slug helper is owned by the converter so the panel chip and the docs
// `#<slug>` anchors share one definition (see `diagnostics/format.ts`).
import { shortCode } from "@invinite-org/chartlang-pine-converter/diagnostics";

export { shortCode };

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Resolve a converter `Diagnostic.span` (1-based line/column, inclusive of
 * `endColumn`) to a `{ from, to }` pair of absolute, in-range CodeMirror
 * document offsets. Guarantees `0 <= from <= to <= doc.length` so the
 * result is always a valid lint range, and widens a zero-width span by one
 * character where possible so the mark stays visible.
 */
export function spanToRange(
    span: Diagnostic["span"],
    doc: Text,
): { from: number; to: number } {
    const startLine = doc.line(clamp(span.startLine, 1, doc.lines));
    const endLine = doc.line(clamp(span.endLine, 1, doc.lines));
    let from = startLine.from + Math.max(0, span.startColumn - 1);
    let to = endLine.from + Math.max(0, span.endColumn - 1);
    from = clamp(from, 0, doc.length);
    to = clamp(to, from, doc.length);
    if (to === from) to = Math.min(from + 1, doc.length);
    return { from, to };
}

/**
 * Convert the converter diagnostics into CodeMirror lint diagnostics for
 * the given document. Severities map one-to-one (`error`/`warning`/`info`).
 */
export function toCmDiagnostics(
    diagnostics: readonly Diagnostic[],
    doc: Text,
): CmDiagnostic[] {
    return diagnostics.map((d) => {
        const { from, to } = spanToRange(d.span, doc);
        const message = d.suggestion === undefined ? d.message : `${d.message}\n\n${d.suggestion}`;
        return { from, to, severity: d.severity, message, source: shortCode(d.code) };
    });
}
