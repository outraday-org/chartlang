// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { javascript } from "@codemirror/lang-javascript";
import { type Extension, EditorState } from "@codemirror/state";
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
 * Pass `opts.service` to enable language-service-backed hover,
 * completions, and diagnostics. Without an injected service the editor
 * mounts as a browser-safe CodeMirror shell and never imports the
 * compiler-backed language-service graph.
 *
 * @since 0.4
 * @stable
 * @example
 *     const parent = document.createElement("div");
 *     const editor = createChartlangEditor({ doc: "const value = 1;", parent });
 *     editor.destroy();
 */
export function createChartlangEditor(opts: ChartlangEditorOpts = {}): ChartlangEditor {
    const state = EditorState.create({
        doc: opts.doc ?? "",
        extensions: [
            basicSetup,
            javascript({ typescript: true }),
            ...languageServiceExtensions(opts),
            ...previewPanelExtensions(opts),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) opts.onSourceChange?.(update.state.doc.toString());
            }),
            // Consumer extensions land LAST so themes / read-only flags /
            // custom keymaps can override the basicSetup defaults.
            ...(opts.extensions ?? []),
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
            void caps;
        },
    });
}

function languageServiceExtensions(opts: ChartlangEditorOpts): ReadonlyArray<Extension> {
    const service = opts.service;
    if (service === undefined) return [];
    return [
        hoverExtension(() => service),
        completionExtension(() => service),
        linterExtension(() => service, opts.onCompiled, opts.lintDebounceMs),
    ];
}

function previewPanelExtensions(opts: ChartlangEditorOpts): ReadonlyArray<Extension> {
    if (opts.previewPanel === true || opts.previewRunner !== undefined) {
        return [peekPanelExtension(opts.previewRunner)];
    }
    return [];
}
