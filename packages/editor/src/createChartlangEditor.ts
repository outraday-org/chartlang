// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { createLanguageService } from "@invinite-org/chartlang-language-service";
import { EditorView, basicSetup } from "codemirror";

import {
    completionExtension,
    hoverExtension,
    linterExtension,
    peekPanelExtension,
} from "./extensions/index.js";
import type { ChartlangEditor, ChartlangEditorOpts } from "./types.js";

/**
 * Create a framework-agnostic CodeMirror 6 chartlang editor.
 *
 * @since 0.4
 * @stable
 * @example
 *     const parent = document.createElement("div");
 *     const editor = createChartlangEditor({ doc: "const value = 1;", parent });
 *     editor.destroy();
 */
export function createChartlangEditor(opts: ChartlangEditorOpts = {}): ChartlangEditor {
    let service = createLanguageService(
        opts.targetCapabilities === undefined
            ? {}
            : { targetCapabilities: opts.targetCapabilities },
    );

    const state = EditorState.create({
        doc: opts.doc ?? "",
        extensions: [
            basicSetup,
            javascript({ typescript: true }),
            hoverExtension(() => service),
            completionExtension(() => service),
            linterExtension(() => service, opts.onCompiled, opts.lintDebounceMs),
            peekPanelExtension(opts.previewRunner),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) opts.onSourceChange?.(update.state.doc.toString());
            }),
        ],
    });
    const view =
        opts.parent === undefined
            ? new EditorView({ state })
            : new EditorView({ state, parent: opts.parent });

    return Object.freeze({
        view,
        destroy(): void {
            view.destroy();
            view.dom.remove();
        },
        setSource(source: string): void {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
        },
        setCapabilities(caps): void {
            service = createLanguageService(caps === null ? {} : { targetCapabilities: caps });
        },
    });
}
