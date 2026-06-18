// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";
import { formatDiagnostic } from "./format.js";
import { DiagnosticReport } from "./report.js";

/**
 * Render a full diagnostic report: a count header followed by the
 * `[errors]` / `[warnings]` / `[infos]` sections, each a stack of
 * {@link formatDiagnostic} blocks separated by a blank line. Empty severity
 * groups are omitted. Used by the CLI (Task 18) for its `--report` / TTY
 * output. `source` is the original Pine input the spans address.
 *
 * @since 0.1
 * @stable
 * @example
 *     const text = formatDiagnosticReport(result.diagnostics, source);
 *     text.startsWith("==== converter diagnostics ===="); // true
 */
export function formatDiagnosticReport(diagnostics: readonly Diagnostic[], source: string): string {
    const report = new DiagnosticReport(diagnostics);
    const errors = report.errors();
    const warnings = report.warnings();
    const infos = report.infos();

    const out: string[] = [];
    out.push("==== converter diagnostics ====");
    out.push(`errors:   ${errors.length}`);
    out.push(`warnings: ${warnings.length}`);
    out.push(`infos:    ${infos.length}`);

    const sections: ReadonlyArray<readonly [string, readonly Diagnostic[]]> = [
        ["errors", errors],
        ["warnings", warnings],
        ["infos", infos],
    ];
    for (const [label, group] of sections) {
        if (group.length === 0) {
            continue;
        }
        out.push("");
        out.push(`[${label}]`);
        out.push(group.map((diagnostic) => formatDiagnostic(diagnostic, source)).join("\n\n"));
    }
    return out.join("\n");
}
