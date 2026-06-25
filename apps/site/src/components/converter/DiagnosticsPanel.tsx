// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Converter diagnostics list. `convert()` returns structured diagnostics
// alongside the output, but the playground previously dropped them — a hard
// reject (e.g. `for … in` over a handle collection) emitted best-effort
// partial output that silently compiled to a blank chart with no on-screen
// signal that anything was wrong. This pane surfaces every diagnostic with
// its severity, short code, message, source location, and suggestion, and
// warns when an error-severity diagnostic means the output is partial /
// not faithful.

import type { Diagnostic } from "@invinite-org/chartlang-pine-converter";
import type { ReactElement } from "react";

/** Props for {@link DiagnosticsPanel}. */
export type DiagnosticsPanelProps = Readonly<{
    diagnostics: readonly Diagnostic[];
}>;

const SEVERITY_ORDER: Record<Diagnostic["severity"], number> = {
    error: 0,
    warning: 1,
    info: 2,
};

const SEVERITY_LABEL: Record<Diagnostic["severity"], string> = {
    error: "Error",
    warning: "Warning",
    info: "Info",
};

/** Last path segment of a `pine-converter/transform/foo` code. */
function shortCode(code: string): string {
    const lastSlash = code.lastIndexOf("/");
    return lastSlash === -1 ? code : code.slice(lastSlash + 1);
}

/**
 * List the converter diagnostics under the output, sorted error → warning →
 * info. When any error is present, a banner explains that the chartlang
 * output is partial — the converter dropped the unconvertible construct, so
 * compiling it may render nothing for that part.
 */
export function DiagnosticsPanel(props: DiagnosticsPanelProps): ReactElement | null {
    const { diagnostics } = props;
    if (diagnostics.length === 0) return null;

    const sorted = [...diagnostics].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
    const hasError = diagnostics.some((d) => d.severity === "error");

    return (
        <section className="converter-diagnostics">
            <h3 className="diagnostics-heading">
                Diagnostics
                <span className="diagnostics-count">{diagnostics.length}</span>
            </h3>
            {hasError ? (
                <p className="diagnostics-reject">
                    This Pine construct is rejected. The converter dropped the unconvertible
                    part and emitted best-effort output for the rest — compiling it may render
                    nothing for the rejected construct.
                </p>
            ) : null}
            <ul className="diagnostics-list">
                {sorted.map((d, i) => (
                    <li className={`diagnostic is-${d.severity}`} key={`${d.code}-${i}`}>
                        <div className="diagnostic-head">
                            <span className="diagnostic-severity">{SEVERITY_LABEL[d.severity]}</span>
                            <code className="diagnostic-code">{shortCode(d.code)}</code>
                            <span className="diagnostic-loc">
                                line {d.span.startLine}:{d.span.startColumn}
                            </span>
                        </div>
                        <p className="diagnostic-message">{d.message}</p>
                        {d.suggestion === undefined ? null : (
                            <p className="diagnostic-suggestion">{d.suggestion}</p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
