// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Read-only chartlang output editor. A CodeMirror instance configured
// read-only with `lang-javascript({ typescript: true })` — the generated
// `.chart.ts` is TypeScript — updated by a dispatched transaction whenever
// the converted output changes (no async highlight flash). Copy / download
// affordances sit in a small toolbar above it.

import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { chartlangDark } from "@invinite-org/chartlang-editor";
import { type ReactElement, useEffect, useRef } from "react";

/** Props for {@link OutputPane}. */
export type OutputPaneProps = Readonly<{
    output: string | null;
    /** Manifest name, used to name the downloaded file. */
    fileBase: string | null;
}>;

function slugify(name: string): string {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length === 0 ? "converted" : slug;
}

/**
 * Right pane of the converter. Renders the generated chartlang source
 * read-only with copy + download buttons. When `output` is `null` (a
 * lex/parse hard error produced no source) a muted placeholder replaces
 * the editor body.
 */
export function OutputPane(props: OutputPaneProps): ReactElement {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (host === null) return;
        const view = new EditorView({
            doc: props.output ?? "",
            parent: host,
            extensions: [
                javascript({ typescript: true }),
                chartlangDark,
                EditorView.editable.of(false),
                EditorState.readOnly.of(true),
            ],
        });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (view === null) return;
        const next = props.output ?? "";
        if (next !== view.state.doc.toString()) {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
        }
    }, [props.output]);

    const hasOutput = props.output !== null && props.output.length > 0;

    const handleCopy = (): void => {
        if (props.output !== null) void navigator.clipboard?.writeText(props.output);
    };

    const handleDownload = (): void => {
        if (props.output === null) return;
        const blob = new Blob([props.output], { type: "text/typescript" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${slugify(props.fileBase ?? "converted")}.chart.ts`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="output">
            <div className="output-toolbar">
                <button
                    className="output-action"
                    disabled={!hasOutput}
                    onClick={handleCopy}
                    type="button"
                >
                    Copy
                </button>
                <button
                    className="output-action"
                    disabled={!hasOutput}
                    onClick={handleDownload}
                    type="button"
                >
                    Download .chart.ts
                </button>
            </div>
            {hasOutput ? null : (
                <p className="output-empty">
                    No chartlang output — resolve the errors on the left.
                </p>
            )}
            <div className="output-editor" ref={hostRef} />
        </div>
    );
}
