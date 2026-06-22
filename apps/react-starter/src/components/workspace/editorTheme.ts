// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Light CodeMirror theme for the starter's editor — the counterpart to the
// editor package's `chartlangDark`. The package ships only a dark theme, so
// the light variant lives here (a One-Light-inspired palette) and the editor
// follows the app's shadcn light/dark mode: EditorPane picks `chartlangDark`
// in dark mode and `chartlangLight` here in light mode. Built from the same
// CodeMirror primitives `chartlangDark` uses, pinned to `^6`/`^1` so they
// dedupe to the editor's single `@codemirror/state` instance (a second copy
// would make CodeMirror reject the extension at mount).

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

// Palette kept perceptually aligned with the stock shadcn neutral light
// surface this starter ships (near-white background, slate ink).
const BG = "#ffffff"
const FG = "#383a42"
const PANEL_BG = "#f5f6f7"
const PANEL_BORDER = "#e1e4e8"
const GUTTER_FG = "#9d9d9f"
const ACTIVE_LINE_GUTTER_BG = "#f0f1f2"
const ACTIVE_LINE_BG = "rgba(56, 58, 66, 0.05)"
const CURSOR = "#4078f2"
const SELECTION = "#d7dbe0"

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
  { dark: false },
)

const highlightStyle = HighlightStyle.define([
  { tag: t.comment, color: "#a0a1a7", fontStyle: "italic" },
  {
    tag: [t.keyword, t.definitionKeyword, t.moduleKeyword],
    color: "#a626a4",
  },
  { tag: [t.string, t.special(t.string)], color: "#50a14f" },
  {
    tag: [t.number, t.bool, t.atom, t.null],
    color: "#b76b01",
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "#4078f2",
  },
  { tag: [t.typeName, t.className], color: "#c18401" },
  {
    tag: [t.propertyName, t.definition(t.propertyName)],
    color: "#e45649",
  },
  {
    tag: [t.variableName, t.definition(t.variableName)],
    color: "#383a42",
  },
  { tag: [t.operator, t.punctuation], color: "#8a8a8a" },
  { tag: t.invalid, color: "#e45649" },
])

/**
 * Light CodeMirror theme + syntax highlight extension for the starter editor,
 * the counterpart to the editor package's `chartlangDark`. Compose it as the
 * last extension so it overrides `basicSetup`'s default light theme.
 */
export const chartlangLight: Extension = [baseTheme, syntaxHighlighting(highlightStyle)]
