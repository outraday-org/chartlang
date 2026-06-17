// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine Script input editor: a raw CodeMirror 6 instance (no chartlang
// language service — Pine is not chartlang). `lang-javascript` gives a
// neutral C/JS-ish highlight that reads fine for Pine, and the linter
// source renders the converter's diagnostics as inline squigglies on the
// input. The editor is uncontrolled after mount (CodeMirror owns the doc);
// the parent re-keys this component on sample switch to reset the doc.

import { javascript } from "@codemirror/lang-javascript";
import { type Diagnostic as CmDiagnostic, forceLinting, lintGutter, linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { chartlangDark } from "@invinite-org/chartlang-editor";
import type { Diagnostic } from "@invinite-org/chartlang-pine-converter";
import { basicSetup } from "codemirror";
import { type ReactElement, useEffect, useRef } from "react";

import { toCmDiagnostics } from "./converterLint";

/** Props for {@link PineInputPane}. */
export type PineInputPaneProps = Readonly<{
    initialSource: string;
    diagnostics: readonly Diagnostic[];
    onSourceChange: (next: string) => void;
}>;

/**
 * Left pane of the converter. Mounts a CodeMirror editor once; the
 * `diagnostics` prop drives a re-lint (via `forceLinting`) without
 * rebuilding the editor, so external conversion results refresh the
 * inline marks in place.
 */
export function PineInputPane(props: PineInputPaneProps): ReactElement {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const diagnosticsRef = useRef(props.diagnostics);
    diagnosticsRef.current = props.diagnostics;
    const onSourceChangeRef = useRef(props.onSourceChange);
    onSourceChangeRef.current = props.onSourceChange;
    // Captured once at mount; the parent re-keys on sample switch.
    const initialSourceRef = useRef(props.initialSource);

    useEffect(() => {
        const host = hostRef.current;
        if (host === null) return;

        const lintSource = (view: EditorView): CmDiagnostic[] =>
            toCmDiagnostics(diagnosticsRef.current, view.state.doc);

        const view = new EditorView({
            doc: initialSourceRef.current,
            parent: host,
            extensions: [
                basicSetup,
                javascript(),
                chartlangDark,
                lintGutter(),
                linter(lintSource, { delay: 0 }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onSourceChangeRef.current(update.state.doc.toString());
                    }
                }),
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
        if (view !== null) forceLinting(view);
    }, [props.diagnostics]);

    return <div className="editor-pane" ref={hostRef} />;
}
