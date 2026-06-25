// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// "Compile & preview" — the full pipeline. The converter output is plain
// chartlang source, so on demand we POST it to the SAME `/api/compile`
// server route the landing demo uses (the real compiler runs server-side;
// the browser keeps its esbuild/node stubs), then lazy-mount the demo's
// `ChartPane` to render the compiled drawing. Kept on-click (not on every
// keystroke) and behind a lazy boundary so the canvas adapter stays out of
// the default page chunk. Resets when the converted output changes.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { type ReactElement, Suspense, lazy, useEffect, useRef, useState } from "react";

import { DEFAULT_ADAPTER_ID } from "../demo/adapters/registry";
import type { CompiledArtifact } from "../demo/hybridLanguageService";

const ChartPane = lazy(() =>
    import("../demo/ChartPane").then((module) => ({ default: module.ChartPane })),
);

const MAX_ALERTS_SHOWN = 6;

type CompileState =
    | Readonly<{ kind: "idle" }>
    | Readonly<{ kind: "compiling" }>
    | Readonly<{ kind: "ok"; warnings: number }>
    | Readonly<{ kind: "error"; message: string }>;

type ParsedCompile =
    | Readonly<{ ok: true; artifact: CompiledArtifact; warnings: number }>
    | Readonly<{ ok: false; message: string }>;

function firstErrorMessage(diagnostics: unknown): string | null {
    if (!Array.isArray(diagnostics)) return null;
    for (const d of diagnostics) {
        if (
            typeof d === "object" &&
            d !== null &&
            (d as { severity?: unknown }).severity === "error" &&
            typeof (d as { message?: unknown }).message === "string"
        ) {
            return (d as { message: string }).message;
        }
    }
    return null;
}

function countWarnings(diagnostics: unknown): number {
    if (!Array.isArray(diagnostics)) return 0;
    return diagnostics.filter(
        (d) => typeof d === "object" && d !== null && (d as { severity?: unknown }).severity === "warning",
    ).length;
}

function parseCompile(raw: unknown): ParsedCompile {
    if (typeof raw !== "object" || raw === null) {
        return { ok: false, message: "Malformed compile response" };
    }
    const obj = raw as Record<string, unknown>;
    if (obj.ok === true && typeof obj.moduleSource === "string" && obj.manifest !== undefined) {
        return {
            ok: true,
            artifact: { moduleSource: obj.moduleSource, manifest: obj.manifest },
            warnings: countWarnings(obj.diagnostics),
        };
    }
    const message =
        firstErrorMessage(obj.diagnostics) ??
        (typeof obj.error === "string" ? obj.error : "The converted script did not compile");
    return { ok: false, message };
}

function statusText(state: CompileState): string {
    switch (state.kind) {
        case "idle":
            return "Run the converted script through the real compiler.";
        case "compiling":
            return "Compiling…";
        case "ok":
            return state.warnings > 0
                ? `Compiled with ${state.warnings} warning(s) — press Play to stream bars.`
                : "Compiled — press Play to stream bars.";
        case "error":
            return state.message;
    }
}

/** Props for {@link CompilePreview}. */
export type CompilePreviewProps = Readonly<{
    output: string | null;
    /**
     * Whether the conversion produced an error-severity diagnostic. When set,
     * the output is a partial best-effort lowering (the converter dropped the
     * rejected construct), so compiling it would render a misleading chart —
     * the button is disabled and the reason is shown instead.
     */
    hasError: boolean;
}>;

/**
 * On-demand compile + chart preview for the converted chartlang output.
 */
export function CompilePreview(props: CompilePreviewProps): ReactElement {
    const [bars, setBars] = useState<ReadonlyArray<Bar>>([]);
    const [artifact, setArtifact] = useState<CompiledArtifact | null>(null);
    const [state, setState] = useState<CompileState>({ kind: "idle" });
    const [alerts, setAlerts] = useState<ReadonlyArray<AlertEmission>>([]);
    const outputRef = useRef(props.output);
    outputRef.current = props.output;

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

    // Editing the Pine source changes the converted output — drop the stale
    // preview so the chart never shows a previous compilation.
    useEffect(() => {
        setArtifact(null);
        setState({ kind: "idle" });
        setAlerts([]);
    }, [props.output]);

    const handleCompile = async (): Promise<void> => {
        const source = outputRef.current;
        if (source === null) return;
        setState({ kind: "compiling" });
        setAlerts([]);
        try {
            const response = await fetch("/api/compile", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ source }),
            });
            if (!response.ok) {
                setState({ kind: "error", message: `Compile request failed (HTTP ${response.status})` });
                return;
            }
            const parsed = parseCompile(await response.json());
            if (parsed.ok) {
                setArtifact(parsed.artifact);
                setState({ kind: "ok", warnings: parsed.warnings });
            } else {
                setArtifact(null);
                setState({ kind: "error", message: parsed.message });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setState({ kind: "error", message });
        }
    };

    const handleAlert = (alert: AlertEmission): void => {
        setAlerts((previous) => {
            const next = [...previous, alert];
            return next.length > MAX_ALERTS_SHOWN ? next.slice(next.length - MAX_ALERTS_SHOWN) : next;
        });
    };

    return (
        <div className="compile-preview">
            <div className="compile-bar">
                <button
                    className="compile-button"
                    disabled={props.output === null || props.hasError || state.kind === "compiling"}
                    onClick={() => void handleCompile()}
                    type="button"
                >
                    Compile &amp; preview
                </button>
                <span className={`compile-status ${state.kind === "error" || props.hasError ? "is-error" : ""}`}>
                    {props.hasError
                        ? "Fix the rejected construct above before compiling — the converted output is partial."
                        : statusText(state)}
                </span>
            </div>
            {artifact === null ? null : (
                <Suspense
                    fallback={
                        <div className="output-empty">Loading the chart renderer…</div>
                    }
                >
                    <div className="pane pane-chart">
                        <ChartPane
                            adapterId={DEFAULT_ADAPTER_ID}
                            artifact={artifact}
                            bars={bars}
                            onAlert={handleAlert}
                            onPlayStart={() => setAlerts([])}
                        />
                        <div className="chart-alerts">
                            <h3 className="panel-title">Recent alerts</h3>
                            {alerts.length === 0 ? (
                                <p className="alerts-empty">No alerts fired yet.</p>
                            ) : (
                                <ul className="alerts">
                                    {alerts.map((alert, i) => (
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
                            )}
                        </div>
                    </div>
                </Suspense>
            )}
        </div>
    );
}
