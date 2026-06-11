// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import {
    type ChartlangLanguageService,
    createLanguageService,
} from "@invinite-org/chartlang-language-service";
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
 * Pass `opts.service` to inject a custom {@link ChartlangLanguageService}
 * (for example a server-backed hybrid service whose `compileToDiagnostics`
 * POSTs to a build endpoint). When injected, the editor never constructs
 * its own service and `setCapabilities(...)` becomes a no-op — the
 * consumer-owned service holds the capability surface.
 *
 * @since 0.4
 * @stable
 * @example
 *     const parent = document.createElement("div");
 *     const editor = createChartlangEditor({ doc: "const value = 1;", parent });
 *     editor.destroy();
 */
export function createChartlangEditor(opts: ChartlangEditorOpts = {}): ChartlangEditor {
    const isInjected = opts.service !== undefined;
    let service: ChartlangLanguageService =
        opts.service ??
        createLanguageService(
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
            // A consumer-provided service owns its own capability surface;
            // rebuilding it here would silently throw the injection away.
            if (isInjected) return;
            service = createLanguageService(caps === null ? {} : { targetCapabilities: caps });
        },
    });
}
