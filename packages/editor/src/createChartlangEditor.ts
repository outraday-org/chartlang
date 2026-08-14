// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { javascript } from "@codemirror/lang-javascript";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";

import {
    completionExtension,
    definitionExtension,
    hoverExtension,
    linterExtension,
    peekPanelExtension,
    signatureHelpExtension,
} from "./extensions/index.js";
import { DEFAULT_EDITOR_FONT_SIZE, clampEditorFontSize, editorFontSizeTheme } from "./fontSize.js";
import { indentationExtension } from "./indentation.js";
import type { ChartlangEditor, ChartlangEditorOpts } from "./types.js";

/**
 * Create a framework-agnostic CodeMirror 6 chartlang editor.
 *
 * Pass `opts.service` to enable language-service-backed hover,
 * completions, diagnostics, signature help, and go-to-definition (the last
 * two opt out via `signatureHelp: false` / `definition: false`). Without an
 * injected service the editor
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
    const fontSizeCompartment = new Compartment();
    const initialFontSize = clampEditorFontSize(opts.fontSize ?? DEFAULT_EDITOR_FONT_SIZE);

    const state = EditorState.create({
        doc: opts.doc ?? "",
        extensions: [
            basicSetup,
            javascript({ typescript: true }),
            ...languageServiceExtensions(opts),
            ...previewPanelExtensions(opts),
            // Baked in by default; suppressed only when the consumer opts out.
            ...(opts.indentation === false ? [] : [indentationExtension]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) opts.onSourceChange?.(update.state.doc.toString());
            }),
            // Consumer extensions land before the font-size theme so themes /
            // read-only flags / custom keymaps can still override the
            // basicSetup defaults, but the font-size theme is appended LAST so
            // the applied size always wins over any consumer theme's font CSS.
            ...(opts.extensions ?? []),
            fontSizeCompartment.of(editorFontSizeTheme(initialFontSize)),
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
        setFontSize(px: number): void {
            view.dispatch({
                effects: fontSizeCompartment.reconfigure(
                    editorFontSizeTheme(clampEditorFontSize(px)),
                ),
            });
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
        // Both default ON, like hover / completions; suppressed only when the
        // consumer opts out.
        ...(opts.signatureHelp === false ? [] : [signatureHelpExtension(() => service)]),
        ...(opts.definition === false ? [] : [definitionExtension(() => service)]),
    ];
}

function previewPanelExtensions(opts: ChartlangEditorOpts): ReadonlyArray<Extension> {
    if (opts.previewPanel === true || opts.previewRunner !== undefined) {
        return [peekPanelExtension(opts.previewRunner)];
    }
    return [];
}
