// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Diagnostics list for the converter. Reuses the demo's `.alert*` styling
// (severity colour comes from `.alert-error`/`.alert-warning`/`.alert-info`)
// and shows each diagnostic's short code, message, source location, and
// suggestion. Sorted error → warning → info, then by line.

import type { Diagnostic } from "@invinite-org/chartlang-pine-converter";
import type { ReactElement } from "react";

import { shortCode } from "./converterLint";

const SEVERITY_RANK: Readonly<Record<Diagnostic["severity"], number>> = {
    error: 0,
    warning: 1,
    info: 2,
};

/** Props for {@link DiagnosticsPanel}. */
export type DiagnosticsPanelProps = Readonly<{
    diagnostics: readonly Diagnostic[];
}>;

/**
 * Renders the converter diagnostics grouped visually by severity colour.
 * An empty list shows a "clean conversion" note.
 */
export function DiagnosticsPanel(props: DiagnosticsPanelProps): ReactElement {
    const sorted = [...props.diagnostics].sort((a, b) => {
        const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return bySeverity !== 0 ? bySeverity : a.span.startLine - b.span.startLine;
    });

    return (
        <div className="panel">
            <h3 className="panel-title">Diagnostics ({props.diagnostics.length})</h3>
            {sorted.length === 0 ? (
                <p className="alerts-empty">No diagnostics — clean conversion.</p>
            ) : (
                <ul className="alerts">
                    {sorted.map((d, i) => (
                        <li
                            className={`alert alert-${d.severity}`}
                            // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics list is render-only
                            key={i}
                        >
                            <span className="alert-sev">{d.severity}</span>
                            <span className="diag-code">{shortCode(d.code)}</span>
                            <span className="alert-msg">{d.message}</span>
                            <span className="diag-loc">
                                L{d.span.startLine}:{d.span.startColumn}
                            </span>
                            {d.suggestion === undefined ? null : (
                                <span className="diag-suggestion">{d.suggestion}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
