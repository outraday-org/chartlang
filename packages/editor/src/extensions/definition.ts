// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type Extension, StateEffect, StateField, type Text } from "@codemirror/state";
import { EditorView, type Tooltip, keymap, showTooltip } from "@codemirror/view";
import type {
    ChartlangLanguageService,
    DefinitionLocation,
    HoverDoc,
} from "@invinite-org/chartlang-language-service";

import { renderHoverDoc } from "./hover.js";

/**
 * File name the language service stamps on an **in-document** definition
 * target (a `<binding>.output("title")` accessor resolved to the producer's
 * `plot(..., { title })` call). Any other `file` is an out-of-document target
 * the browser cannot open, and is handled by the hover-doc fallback.
 *
 * @since 2.5
 * @stable
 * @example
 *     const name: string = DEFAULT_SCRIPT_FILE_NAME;
 *     void name;
 */
export const DEFAULT_SCRIPT_FILE_NAME = "script.chart.ts";

/**
 * Options accepted by {@link definitionExtension}.
 *
 * `scriptFileName` is the `DefinitionLocation.file` value that means "this
 * document". Override it only when the injected service parses under a
 * different script file name than the language-service default.
 *
 * @since 2.5
 * @stable
 * @example
 *     const opts: DefinitionExtensionOpts = { scriptFileName: "demo.chart.ts" };
 *     void opts;
 */
export type DefinitionExtensionOpts = Readonly<{
    scriptFileName?: string;
}>;

/**
 * Create a CM6 go-to-definition extension backed by `service.getDefinition`.
 * Bound to Cmd/Ctrl-click and to `F12` at the cursor.
 *
 * The language service resolves exactly two things, and the extension treats
 * them differently:
 *
 * - a `<binding>.output("title")` dependency accessor resolves to a REAL
 *   in-document position — the extension **jumps** there;
 * - a stdlib symbol resolves to a placeholder declaration file that does not
 *   exist in a browser bundle — the extension **shows that symbol's hover doc**
 *   instead of peeking an empty file.
 *
 * This is distinct from `peekPanelExtension`, which owns the preview panel and
 * has nothing to do with definitions.
 *
 * @since 2.5
 * @stable
 * @example
 *     const extension = definitionExtension(() => createLanguageService());
 *     void extension;
 */
export function definitionExtension(
    getService: () => ChartlangLanguageService,
    opts: DefinitionExtensionOpts = {},
): Extension {
    const scriptFileName = opts.scriptFileName ?? DEFAULT_SCRIPT_FILE_NAME;
    return [
        definitionTooltipField,
        keymap.of([
            {
                key: "F12",
                run: (view) =>
                    goToDefinition(
                        view,
                        getService,
                        scriptFileName,
                        view.state.selection.main.head,
                    ),
            },
        ]),
        EditorView.domEventHandlers({
            mousedown: (event, view) => {
                if (!event.metaKey && !event.ctrlKey) return false;
                const offset = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
                goToDefinition(view, getService, scriptFileName, offset);
                // A modifier-click is a navigation gesture. Consume it even
                // when nothing resolves, so it never falls through to
                // CodeMirror's drag-selection.
                return true;
            },
        }),
    ];
}

/**
 * Map a 1-based {@link DefinitionLocation} onto a CodeMirror document offset,
 * clamping an out-of-range line or column into the document instead of
 * throwing. Mirrors the clamping the linter extension applies to diagnostic
 * ranges.
 *
 * @since 2.5
 * @stable
 * @example
 *     // definitionOffset(doc, { file: "script.chart.ts", line: 2, column: 5 })
 *     const fn: typeof definitionOffset = definitionOffset;
 *     void fn;
 */
export function definitionOffset(doc: Text, location: DefinitionLocation): number {
    const line = doc.line(Math.min(doc.lines, Math.max(1, location.line)));
    return Math.min(line.to, line.from + Math.max(0, location.column - 1));
}

const setDefinitionTooltip = StateEffect.define<Tooltip | null>();

const definitionTooltipField = StateField.define<Tooltip | null>({
    create: () => null,
    update: (value, tr) => {
        let next = tr.docChanged ? null : value;
        for (const effect of tr.effects) {
            if (effect.is(setDefinitionTooltip)) next = effect.value;
        }
        return next;
    },
    provide: (field) => showTooltip.from(field),
});

function goToDefinition(
    view: EditorView,
    getService: () => ChartlangLanguageService,
    scriptFileName: string,
    offset: number,
): boolean {
    const service = getService();
    const source = view.state.doc.toString();
    const location = service.getDefinition(source, offset);
    if (location === null) {
        view.dispatch({ effects: setDefinitionTooltip.of(null) });
        return false;
    }
    if (location.file === scriptFileName) {
        view.dispatch({
            selection: { anchor: definitionOffset(view.state.doc, location) },
            scrollIntoView: true,
            effects: setDefinitionTooltip.of(null),
        });
        return true;
    }
    const doc = service.getHoverDoc(source, offset);
    if (doc === null) {
        view.dispatch({ effects: setDefinitionTooltip.of(null) });
        return false;
    }
    view.dispatch({ effects: setDefinitionTooltip.of(definitionDocTooltip(offset, doc)) });
    return true;
}

function definitionDocTooltip(offset: number, doc: HoverDoc): Tooltip {
    return {
        pos: offset,
        above: true,
        create: () => {
            const dom = document.createElement("div");
            dom.className = "chartlang-definition";
            dom.append(renderHoverDoc(doc));
            return { dom };
        },
    };
}
