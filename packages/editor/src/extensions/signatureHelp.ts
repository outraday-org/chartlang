// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type EditorState, type Extension, StateField } from "@codemirror/state";
import { type Tooltip, showTooltip } from "@codemirror/view";
import type {
    ChartlangLanguageService,
    SignatureHelp,
} from "@invinite-org/chartlang-language-service";

/**
 * Create a CM6 signature-help tooltip extension backed by
 * `service.getSignatureHelp`. The tooltip tracks the cursor: it appears once
 * the caret sits inside a primitive call's argument list and highlights the
 * parameter the caret is currently on.
 *
 * Capability filtering is the service's job — `createLanguageService({
 * targetCapabilities })` already returns a filtered surface, so this extension
 * never re-filters.
 *
 * @since 2.5
 * @stable
 * @example
 *     const extension = signatureHelpExtension(() => createLanguageService());
 *     void extension;
 */
export function signatureHelpExtension(getService: () => ChartlangLanguageService): Extension {
    return StateField.define<Tooltip | null>({
        create: (state) => signatureTooltip(getService, state),
        update: (value, tr) =>
            tr.docChanged || tr.selection !== undefined
                ? signatureTooltip(getService, tr.state)
                : value,
        provide: (field) => showTooltip.from(field),
    });
}

function signatureTooltip(
    getService: () => ChartlangLanguageService,
    state: EditorState,
): Tooltip | null {
    const cursor = state.selection.main;
    if (!cursor.empty) return null;
    const help = getService().getSignatureHelp(state.doc.toString(), cursor.head);
    if (help === null) return null;
    return {
        pos: cursor.head,
        above: true,
        create: () => ({ dom: renderSignatureHelp(help) }),
    };
}

function renderSignatureHelp(help: SignatureHelp): HTMLElement {
    const root = document.createElement("div");
    root.className = "chartlang-signature";

    const label = document.createElement("code");
    label.className = "chartlang-signature-label";
    label.textContent = help.label;
    root.append(label);

    if (help.parameters.length > 0) {
        const list = document.createElement("ol");
        list.className = "chartlang-signature-params";
        help.parameters.forEach((param, index) => {
            const item = document.createElement("li");
            item.className =
                index === help.activeParameter
                    ? "chartlang-signature-param chartlang-signature-active"
                    : "chartlang-signature-param";
            item.textContent = `${param.name} — ${param.doc}`;
            list.append(item);
        });
        root.append(list);
    }
    return root;
}
