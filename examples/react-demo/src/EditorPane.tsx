// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
    completionExtension,
    hoverExtension,
    linterExtension,
    peekPanelExtension,
} from "@invinite-org/chartlang-editor";
import { basicSetup } from "codemirror";
import { type ReactElement, useEffect, useRef } from "react";

import type { createHybridLanguageService } from "./hybridLanguageService";

type LanguageService = ReturnType<typeof createHybridLanguageService>;

const LINT_DEBOUNCE_MS = 500;

/**
 * Props for {@link EditorPane}. The pane mounts the CodeMirror view
 * once and never re-creates it — source updates flow through the
 * imperative `view.dispatch(...)` path, not through React re-renders.
 */
export type EditorPaneProps = Readonly<{
    initialSource: string;
    service: LanguageService;
    onSourceChange: (next: string) => void;
}>;

/**
 * Left half of the demo — assembles the same extensions
 * `createChartlangEditor` uses, but bound to the hybrid service.
 */
export function EditorPane(props: EditorPaneProps): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onSourceChangeRef = useRef(props.onSourceChange);
    onSourceChangeRef.current = props.onSourceChange;

    useEffect(() => {
        const container = containerRef.current;
        if (container === null) return;

        const service = props.service;
        const state = EditorState.create({
            doc: props.initialSource,
            extensions: [
                basicSetup,
                javascript({ typescript: true }),
                hoverExtension(() => service),
                completionExtension(() => service),
                linterExtension(() => service, undefined, LINT_DEBOUNCE_MS),
                peekPanelExtension(),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onSourceChangeRef.current(update.state.doc.toString());
                    }
                }),
                EditorView.theme(
                    {
                        "&": { height: "100%", fontSize: "13px" },
                        ".cm-scroller": { fontFamily: "ui-monospace, monospace" },
                    },
                    { dark: true },
                ),
            ],
        });

        const view = new EditorView({ state, parent: container });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // The editor is created once. The hybrid service is stable across
        // the lifetime of the app, and source updates flow through CM
        // dispatch — not React re-render.
    }, [props.initialSource, props.service]);

    return <div className="editor-pane" ref={containerRef} />;
}
