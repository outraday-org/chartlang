// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Extension } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import type { createLanguageService } from "@invinite-org/chartlang-language-service";
import type { HoverDoc } from "@invinite-org/chartlang-language-service";

type LanguageService = ReturnType<typeof createLanguageService>;

/**
 * Create a CM6 hover tooltip extension backed by chartlang language-service
 * hover docs.
 *
 * @since 0.4
 * @stable
 * @example
 *     const extension = hoverExtension(() => createLanguageService());
 *     void extension;
 */
export function hoverExtension(getService: () => LanguageService): Extension {
    return hoverTooltip((view, pos) => {
        const doc = getService().getHoverDoc(view.state.doc.toString(), pos);
        if (doc === null) return null;
        return {
            pos,
            above: true,
            create: () => ({ dom: renderHoverDoc(doc) }),
        };
    });
}

function renderHoverDoc(doc: HoverDoc): HTMLElement {
    const root = document.createElement("div");
    root.className = "chartlang-hover";

    const title = document.createElement("code");
    title.className = "chartlang-hover-title";
    title.textContent = doc.title;
    root.append(title);

    const summary = document.createElement("p");
    summary.className = "chartlang-hover-summary";
    summary.textContent = doc.summary;
    root.append(summary);

    if (doc.paramTable !== undefined && doc.paramTable.length > 0) {
        const list = document.createElement("dl");
        list.className = "chartlang-hover-params";
        for (const param of doc.paramTable) {
            const name = document.createElement("dt");
            name.textContent = `${param.name}: ${param.type}`;
            const detail = document.createElement("dd");
            detail.textContent = param.doc;
            list.append(name, detail);
        }
        root.append(list);
    }
    return root;
}
