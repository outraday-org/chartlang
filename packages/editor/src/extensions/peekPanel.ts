// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Create the Phase 4 placeholder peek-panel extension.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const extension = peekPanelExtension();
 *     void extension;
 */
export function peekPanelExtension(previewRunner?: unknown): Extension {
    void previewRunner;
    return ViewPlugin.fromClass(PeekPanelPlugin);
}

class PeekPanelPlugin {
    readonly dom: HTMLElement;

    constructor(view: EditorView) {
        this.dom = document.createElement("section");
        this.dom.className = "chartlang-peek-panel";
        this.dom.textContent = "preview unavailable in Phase 4";
        view.dom.after(this.dom);
    }

    update(update: ViewUpdate): void {
        void update;
    }

    destroy(): void {
        this.dom.remove();
    }
}
