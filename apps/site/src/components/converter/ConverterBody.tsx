// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Client-only body of the converter playground. Lazy-loaded as the default
// export so CodeMirror splits out of the route entry chunk. Pine input
// (left) converts live in the browser to chartlang output (right), and an
// on-demand "Compile & preview" runs the output through the real compiler
// and renders the chart.

import { type ReactElement, useEffect, useState } from "react";

import "../demo/demo.css";
import "./converter.css";

import { CompileBar, CompilePreviewChart, useCompilePreview } from "./CompilePreview";
import { ConverterControls } from "./ConverterControls";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { OutputPane } from "./OutputPane";
import { PineExampleBrowser } from "./PineExampleBrowser";
import { PineInputPane } from "./PineInputPane";
import { PINE_SCRIPTS } from "./pineScripts";
import { useConverter } from "./useConverter";

/**
 * Resolve the initial sample id from a `?script=<id>` query param so links
 * can deep-link a specific example; falls back to the first sample.
 */
function initialScriptId(): string {
    const fallback = PINE_SCRIPTS[0]?.id ?? "";
    if (typeof window === "undefined") return fallback;
    const requested = new URLSearchParams(window.location.search).get("script");
    return requested !== null && PINE_SCRIPTS.some((s) => s.id === requested) ? requested : fallback;
}

/**
 * Persist the converter's `?script=` selection via `history.replaceState`
 * (no router navigation — the converter is client-only + lazy). Leaves the
 * pathname, hash, and every other query param untouched. Mirrors the demo's
 * `syncDemoParam`.
 */
function syncConverterParam(id: string): void {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("script", id);
    const { pathname, hash } = window.location;
    history.replaceState(null, "", `${pathname}?${params.toString()}${hash}`);
}

/**
 * The converter playground. Wires the Pine input, the live conversion
 * hook, the chartlang output, and the compile-&-preview block.
 */
export default function ConverterBody(): ReactElement {
    const [scriptId, setScriptId] = useState(initialScriptId);
    const script = PINE_SCRIPTS.find((s) => s.id === scriptId) ?? PINE_SCRIPTS[0];
    const [source, setSource] = useState(script?.source ?? "");
    const [barInterval, setBarInterval] = useState<number | null>(null);
    const [strictMode, setStrictMode] = useState(false);

    const result = useConverter(source, { barInterval, strictMode });
    const hasError = result.diagnostics.some((d) => d.severity === "error");
    const compile = useCompilePreview(result.output);

    const switchScript = (id: string): void => {
        const next = PINE_SCRIPTS.find((s) => s.id === id);
        setScriptId(id);
        setSource(next?.source ?? "");
        syncConverterParam(id);
    };

    // On mount, write the resolved selection back to the URL so it always
    // reflects the shown sample — even when loaded with a missing/unknown
    // `?script=` (which falls back to the first sample above). Runs once.
    useEffect(() => {
        syncConverterParam(scriptId);
        // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only URL seed
    }, []);

    return (
        <div className="cl-demo cl-converter mt-10 space-y-4">
            <div className="converter-toolbar">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Sample</span>
                    <PineExampleBrowser
                        activeId={script?.id ?? ""}
                        onSelect={switchScript}
                        scripts={PINE_SCRIPTS}
                    />
                </label>
                <ConverterControls
                    barInterval={barInterval}
                    onBarIntervalChange={setBarInterval}
                    onStrictModeChange={setStrictMode}
                    strictMode={strictMode}
                />
            </div>

            {script?.description === undefined ? null : (
                <p className="text-sm text-muted-foreground">{script.description}</p>
            )}

            <CompileBar controller={compile} hasError={hasError} output={result.output} />

            <CompilePreviewChart controller={compile} />

            <div className="panes">
                <section className="pane pane-editor">
                    <PineInputPane
                        initialSource={script?.source ?? ""}
                        key={script?.id ?? "none"}
                        onSourceChange={setSource}
                    />
                </section>
                <section className="pane">
                    <OutputPane fileBase={result.manifest?.name ?? null} output={result.output} />
                </section>
            </div>

            <DiagnosticsPanel diagnostics={result.diagnostics} />
        </div>
    );
}
