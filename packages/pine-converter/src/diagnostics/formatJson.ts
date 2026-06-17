// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";

/**
 * Serialize a diagnostic list to JSON with a STABLE per-diagnostic property
 * order (`code`, `severity`, `message`, `span`, `suggestion`) so the output is
 * byte-deterministic across runs and machines. `suggestion` is omitted when
 * absent (never emitted as `null`). Used by the CLI's `--diagnostics-json`
 * mode (Task 18). Indented two spaces.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const json = formatDiagnosticsJson([
 *         {
 *             code: "pine-converter/parse/unexpected-token",
 *             severity: "error",
 *             message: "Unexpected token.",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
 *         },
 *     ]);
 *     JSON.parse(json)[0].code; // "pine-converter/parse/unexpected-token"
 */
export function formatDiagnosticsJson(diagnostics: readonly Diagnostic[]): string {
    const ordered = diagnostics.map((diagnostic) => {
        const base: Record<string, unknown> = {
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            span: {
                startLine: diagnostic.span.startLine,
                startColumn: diagnostic.span.startColumn,
                endLine: diagnostic.span.endLine,
                endColumn: diagnostic.span.endColumn,
            },
        };
        if (diagnostic.suggestion !== undefined) {
            base.suggestion = diagnostic.suggestion;
        }
        return base;
    });
    return JSON.stringify(ordered, null, 2);
}
