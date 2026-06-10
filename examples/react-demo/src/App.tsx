// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import type { LspDiagnostic } from "@invinite-org/chartlang-language-service";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { ChartPane } from "./ChartPane";
import { EditorPane } from "./EditorPane";
import {
    type CompileStatus,
    type CompiledArtifact,
    createHybridLanguageService,
} from "./hybridLanguageService";
import { INITIAL_SOURCE } from "./initialSource";

const MAX_ALERTS_SHOWN = 6;

function StatusBadge(props: Readonly<{ status: CompileStatus }>): ReactElement {
    const { status } = props;
    switch (status.kind) {
        case "idle":
            return <span className="status status-idle">idle</span>;
        case "compiling":
            return <span className="status status-compiling">compiling…</span>;
        case "ok":
            return (
                <span className="status status-ok">
                    ok{status.warningCount > 0 ? ` · ${status.warningCount} warn` : ""}
                </span>
            );
        case "error":
            return (
                <span className="status status-error">
                    {status.errorCount} error{status.errorCount === 1 ? "" : "s"}
                    {status.warningCount > 0 ? ` · ${status.warningCount} warn` : ""}
                </span>
            );
        case "transport-error":
            return <span className="status status-error">transport: {status.message}</span>;
    }
}

function DiagnosticsList(
    props: Readonly<{ diagnostics: ReadonlyArray<LspDiagnostic> }>,
): ReactElement | null {
    if (props.diagnostics.length === 0) return null;
    return (
        <ul className="diagnostics">
            {props.diagnostics.slice(0, 5).map((d, i) => (
                <li
                    className={`diag diag-${d.severity}`}
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable order within one compile
                    key={i}
                >
                    <span className="diag-loc">
                        {d.range.startLine}:{d.range.startColumn}
                    </span>{" "}
                    <span className="diag-code">{d.code}</span>{" "}
                    <span className="diag-msg">{d.message}</span>
                </li>
            ))}
        </ul>
    );
}

function AlertsList(props: Readonly<{ alerts: ReadonlyArray<AlertEmission> }>): ReactElement {
    if (props.alerts.length === 0) {
        return <p className="alerts-empty">No alerts fired yet.</p>;
    }
    return (
        <ul className="alerts">
            {props.alerts.map((alert, i) => (
                <li
                    className={`alert alert-${alert.severity}`}
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only feed
                    key={i}
                >
                    <span className="alert-sev">{alert.severity}</span>{" "}
                    <span className="alert-msg">{alert.message}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * Root component — wires the editor (left), chart (right), and a
 * status bar (bottom). The hybrid service is created once and shared
 * across the lifetime of the app.
 */
export function App(): ReactElement {
    const [status, setStatus] = useState<CompileStatus>({ kind: "idle" });
    const [diagnostics, setDiagnostics] = useState<ReadonlyArray<LspDiagnostic>>([]);
    const [artifact, setArtifact] = useState<CompiledArtifact | null>(null);
    const [bars, setBars] = useState<ReadonlyArray<Bar>>([]);
    const [alerts, setAlerts] = useState<ReadonlyArray<AlertEmission>>([]);
    const setStatusRef = useRef(setStatus);
    const setDiagnosticsRef = useRef(setDiagnostics);
    const setArtifactRef = useRef(setArtifact);
    setStatusRef.current = setStatus;
    setDiagnosticsRef.current = setDiagnostics;
    setArtifactRef.current = setArtifact;

    const service = useMemo(
        () =>
            createHybridLanguageService((nextStatus, nextArtifact, nextDiagnostics) => {
                setStatusRef.current(nextStatus);
                setDiagnosticsRef.current(nextDiagnostics);
                if (nextArtifact !== null) setArtifactRef.current(nextArtifact);
            }),
        [],
    );

    useEffect(() => {
        let cancelled = false;
        void (async (): Promise<void> => {
            const response = await fetch("/bars.json");
            const raw: unknown = await response.json();
            if (cancelled || !Array.isArray(raw)) return;
            setBars(raw as ReadonlyArray<Bar>);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleAlert = (alert: AlertEmission): void => {
        setAlerts((previous) => {
            const next = [...previous, alert];
            return next.length > MAX_ALERTS_SHOWN
                ? next.slice(next.length - MAX_ALERTS_SHOWN)
                : next;
        });
    };

    return (
        <div className="app">
            <header className="header">
                <h1>chartlang react demo</h1>
                <StatusBadge status={status} />
            </header>
            <main className="panes">
                <section className="pane pane-editor">
                    <EditorPane
                        initialSource={INITIAL_SOURCE}
                        onSourceChange={() => {
                            /* editor drives compile via the linter extension */
                        }}
                        service={service}
                    />
                </section>
                <section className="pane pane-chart">
                    <ChartPane artifact={artifact} bars={bars} onAlert={handleAlert} />
                </section>
            </main>
            <footer className="footer">
                <div className="footer-col">
                    <h2>Diagnostics</h2>
                    <DiagnosticsList diagnostics={diagnostics} />
                </div>
                <div className="footer-col">
                    <h2>Recent alerts</h2>
                    <AlertsList alerts={alerts} />
                </div>
            </footer>
        </div>
    );
}
