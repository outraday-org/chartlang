// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Palette pinned here so the consuming dark UI (e.g. react-demo) and the
// CodeMirror surface stay perceptually aligned. Numbers are duplicated
// nowhere — they are the source of truth for the editor chrome.
const BG = "#0e1218";
const FG = "#d8dee9";
const PANEL_BG = "#161b22";
const PANEL_BORDER = "#2a313c";
const GUTTER_FG = "#5c6773";
const ACTIVE_LINE_GUTTER_BG = "#1c222b";
const ACTIVE_LINE_BG = "rgba(40, 50, 65, 0.4)";
const CURSOR = "#4dabf7";
const SELECTION = "#2a4a6b";

const baseTheme = EditorView.theme(
    {
        "&": {
            backgroundColor: BG,
            color: FG,
        },
        ".cm-content": {
            caretColor: CURSOR,
            color: FG,
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: CURSOR,
        },
        "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
            backgroundColor: SELECTION,
        },
        ".cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: SELECTION,
        },
        ".cm-activeLine": {
            backgroundColor: ACTIVE_LINE_BG,
        },
        ".cm-gutters": {
            backgroundColor: BG,
            color: GUTTER_FG,
            borderRight: `1px solid ${PANEL_BORDER}`,
        },
        ".cm-activeLineGutter": {
            backgroundColor: ACTIVE_LINE_GUTTER_BG,
        },
        ".cm-foldPlaceholder": {
            backgroundColor: "transparent",
            border: "none",
            color: GUTTER_FG,
        },
        ".cm-panels": {
            backgroundColor: PANEL_BG,
            color: FG,
            border: `1px solid ${PANEL_BORDER}`,
        },
        ".cm-panels.cm-panels-top": {
            borderBottom: `1px solid ${PANEL_BORDER}`,
        },
        ".cm-panels.cm-panels-bottom": {
            borderTop: `1px solid ${PANEL_BORDER}`,
        },
        ".cm-searchMatch": {
            backgroundColor: SELECTION,
            outline: `1px solid ${PANEL_BORDER}`,
        },
        ".cm-searchMatch.cm-searchMatch-selected": {
            backgroundColor: CURSOR,
        },
        ".cm-matchingBracket, .cm-nonmatchingBracket": {
            outline: `1px solid ${CURSOR}`,
        },
        ".cm-tooltip": {
            backgroundColor: PANEL_BG,
            border: `1px solid ${PANEL_BORDER}`,
            color: FG,
        },
        ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
            backgroundColor: ACTIVE_LINE_GUTTER_BG,
            color: FG,
        },
        ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
            color: FG,
        },
    },
    { dark: true },
);

const highlightStyle = HighlightStyle.define([
    { tag: t.comment, color: "#7d8799", fontStyle: "italic" },
    {
        tag: [t.keyword, t.definitionKeyword, t.moduleKeyword],
        color: "#c678dd",
    },
    { tag: [t.string, t.special(t.string)], color: "#98c379" },
    {
        tag: [t.number, t.bool, t.atom, t.null],
        color: "#d19a66",
    },
    {
        tag: [t.function(t.variableName), t.function(t.propertyName)],
        color: "#61afef",
    },
    { tag: [t.typeName, t.className], color: "#e5c07b" },
    {
        tag: [t.propertyName, t.definition(t.propertyName)],
        color: "#e06c75",
    },
    {
        tag: [t.variableName, t.definition(t.variableName)],
        color: "#d8dee9",
    },
    { tag: [t.operator, t.punctuation], color: "#9aa5b1" },
    { tag: t.invalid, color: "#ef5350" },
]);

/**
 * Dark CodeMirror theme + syntax highlight extension tuned for the
 * chartlang reference editor.
 *
 * Compose as the last extension passed to {@link createChartlangEditor}
 * (via `opts.extensions`) so it overrides the default light theme that
 * `basicSetup` ships. The palette is harmonised with the react-demo's
 * dark chrome (`#0e1218` background, `#161b22` panels) and the syntax
 * highlight pass is a One-Dark-inspired token set.
 *
 * @since 1.2
 * @stable
 * @example
 *     import { chartlangDark, createChartlangEditor } from "@invinite-org/chartlang-editor";
 *
 *     const editor = createChartlangEditor({
 *         parent: document.body,
 *         extensions: [chartlangDark],
 *     });
 *     void editor;
 */
export const chartlangDark: Extension = [baseTheme, syntaxHighlighting(highlightStyle)];
