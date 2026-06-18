// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Pine Script input editor: a raw CodeMirror 6 instance (no chartlang
// language service — Pine is not chartlang). `lang-javascript` gives a
// neutral C/JS-ish highlight that reads fine for Pine. The editor carries
// no diagnostics — Pine is not type-checked here, so no inline marks. It is
// uncontrolled after mount (CodeMirror owns the doc); the parent re-keys
// this component on sample switch to reset the doc.

import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { chartlangDark } from "@invinite-org/chartlang-editor";
import { basicSetup } from "codemirror";
import { type ReactElement, useEffect, useRef } from "react";

/** Props for {@link PineInputPane}. */
export type PineInputPaneProps = Readonly<{
    initialSource: string;
    onSourceChange: (next: string) => void;
}>;

/**
 * Left pane of the converter. Mounts a CodeMirror editor once and reports
 * doc changes to the parent. No language service and no linter — Pine is
 * not chartlang, so the input is never diagnosed.
 */
export function PineInputPane(props: PineInputPaneProps): ReactElement {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onSourceChangeRef = useRef(props.onSourceChange);
    onSourceChangeRef.current = props.onSourceChange;
    // Captured once at mount; the parent re-keys on sample switch.
    const initialSourceRef = useRef(props.initialSource);

    useEffect(() => {
        const host = hostRef.current;
        if (host === null) return;

        const view = new EditorView({
            doc: initialSourceRef.current,
            parent: host,
            extensions: [
                basicSetup,
                javascript(),
                chartlangDark,
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

    return <div className="editor-pane" ref={hostRef} />;
}
