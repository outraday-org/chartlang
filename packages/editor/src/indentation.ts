// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Extension } from "@codemirror/state";

import {
    indentLess,
    indentMore,
    insertNewlineAndIndent,
    insertNewlineKeepIndent,
} from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { keymap, type Command } from "@codemirror/view";

/** Matches the 4-space indentation of the chartlang example templates. */
const INDENT = "    ";

/**
 * Tab: with a selection, indent every selected line by one unit; with a
 * bare cursor, insert one indent unit at the cursor (spaces, never a
 * literal `\t` — chartlang sources are space-indented).
 */
const insertIndentUnit: Command = (view) => {
    const { state } = view;

    if (state.selection.ranges.some((range) => !range.empty)) return indentMore(view);

    view.dispatch(
        state.update(state.replaceSelection(state.facet(indentUnit)), {
            scrollIntoView: true,
            userEvent: "input",
        }),
    );

    return true;
};

/**
 * Enter: keep the previous line's indentation (`insertNewlineKeepIndent`)
 * instead of basicSetup's syntax-computed indent, which snaps manually
 * indented lines back to column 0. The one case where the syntax-aware
 * default is strictly better — the cursor sitting between auto-closed
 * brackets (`{|}`), where it expands to three lines with an indented
 * body — falls through to `insertNewlineAndIndent`.
 */
const insertNewlineMatchingPreviousLine: Command = (view) => {
    const { state } = view;

    const everyCursorBetweenBrackets = state.selection.ranges.every(
        (range) =>
            range.empty &&
            range.from > 0 &&
            /\(\)|\[\]|\{\}/.test(state.sliceDoc(range.from - 1, range.from + 1)),
    );

    if (everyCursorBetweenBrackets) return insertNewlineAndIndent(view);

    return insertNewlineKeepIndent(view);
};

/**
 * Indentation behavior for the chartlang CodeMirror mounts.
 *
 * `createChartlangEditor` bakes this in by default (opt out with
 * `opts.indentation === false`). Consumer extensions land AFTER
 * `basicSetup`, which for keymaps means LOWER precedence — so the Enter
 * binding must be `Prec.high` to beat basicSetup's `defaultKeymap` Enter.
 * It stays below `Prec.highest`, where autocompletion registers its
 * accept-on-Enter binding, so completion picks still win over the newline.
 *
 * @since 2.4
 * @stable
 * @example
 *     import { createChartlangEditor, indentationExtension } from "@invinite-org/chartlang-editor";
 *
 *     // Baked in by default; compose manually only when opting out
 *     // (`indentation: false`) and re-adding a customised keymap.
 *     const editor = createChartlangEditor({
 *         parent: document.body,
 *         indentation: false,
 *         extensions: [indentationExtension],
 *     });
 *     void editor;
 */
export const indentationExtension: Extension = [
    indentUnit.of(INDENT),
    Prec.high(
        keymap.of([
            { key: "Tab", run: insertIndentUnit, shift: indentLess },
            { key: "Enter", run: insertNewlineMatchingPreviousLine },
        ]),
    ),
];
