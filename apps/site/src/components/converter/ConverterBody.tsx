// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Client-only body of the converter playground. Lazy-loaded as the default
// export so CodeMirror splits out of the route entry chunk. Pine input
// (left) converts live in the browser to chartlang output (right), and an
// on-demand "Compile & preview" runs the output through the real compiler
// and renders the chart.

import { type ReactElement, useState } from "react";

import "../demo/demo.css";
import "./converter.css";

import { CompilePreview } from "./CompilePreview";
import { ConverterControls } from "./ConverterControls";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { OutputPane } from "./OutputPane";
import { PineInputPane } from "./PineInputPane";
import { PINE_SCRIPTS } from "./pineScripts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

    const switchScript = (id: string): void => {
        const next = PINE_SCRIPTS.find((s) => s.id === id);
        setScriptId(id);
        setSource(next?.source ?? "");
    };

    return (
        <div className="cl-demo cl-converter mt-10 space-y-4">
            <div className="converter-toolbar">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Sample</span>
                    <Select
                        items={PINE_SCRIPTS.map((s) => ({ label: s.label, value: s.id }))}
                        onValueChange={(value) => switchScript(value ?? "")}
                        value={script?.id ?? ""}
                    >
                        <SelectTrigger className="w-[220px]" size="sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PINE_SCRIPTS.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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

            <CompilePreview hasError={hasError} output={result.output} />
        </div>
    );
}
