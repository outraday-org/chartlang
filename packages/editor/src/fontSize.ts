// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Extension } from "@codemirror/state";

import { EditorView } from "@codemirror/view";

/**
 * Default editor font size in px when no `fontSize` is supplied.
 *
 * @since 2.4
 * @example
 *     import { DEFAULT_EDITOR_FONT_SIZE } from "@invinite-org/chartlang-editor";
 *     void DEFAULT_EDITOR_FONT_SIZE; // 14
 */
export const DEFAULT_EDITOR_FONT_SIZE = 14;

/**
 * Smallest font size the editor clamps to.
 *
 * @since 2.4
 * @example
 *     import { MIN_EDITOR_FONT_SIZE } from "@invinite-org/chartlang-editor";
 *     void MIN_EDITOR_FONT_SIZE; // 11
 */
export const MIN_EDITOR_FONT_SIZE = 11;

/**
 * Largest font size the editor clamps to.
 *
 * @since 2.4
 * @example
 *     import { MAX_EDITOR_FONT_SIZE } from "@invinite-org/chartlang-editor";
 *     void MAX_EDITOR_FONT_SIZE; // 22
 */
export const MAX_EDITOR_FONT_SIZE = 22;

/**
 * Suggested preset sizes for a consumer-built font-size control. Every
 * entry sits inside the `[MIN, MAX]` clamp range.
 *
 * @since 2.4
 * @example
 *     import { EDITOR_FONT_SIZE_PRESETS } from "@invinite-org/chartlang-editor";
 *     void EDITOR_FONT_SIZE_PRESETS; // [12, 14, 16, 18, 20]
 */
export const EDITOR_FONT_SIZE_PRESETS: ReadonlyArray<number> = [12, 14, 16, 18, 20];

/**
 * Clamp an arbitrary font size to the supported `[11, 22]` range, rounding
 * to the nearest whole pixel. Non-finite input falls back to the default.
 *
 * @since 2.4
 * @stable
 * @example
 *     clampEditorFontSize(9); // 11
 *     clampEditorFontSize(30); // 22
 *     clampEditorFontSize(15.6); // 16
 */
export function clampEditorFontSize(px: number): number {
    if (!Number.isFinite(px)) return DEFAULT_EDITOR_FONT_SIZE;
    return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, Math.round(px)));
}

/**
 * CodeMirror theme extension that applies a font size (px) and a matching
 * `1.55×` line height across the editor surface (content, gutters, lines).
 *
 * `createChartlangEditor` owns this theme inside a `Compartment` so
 * `editor.setFontSize(px)` can reconfigure it live without remounting the
 * view — pass `opts.fontSize` to seed the initial size. It is exported so
 * consumers building their own font-size UI (or a merge / diff editor)
 * can compose it directly.
 *
 * @since 2.4
 * @stable
 * @example
 *     import { createChartlangEditor, editorFontSizeTheme } from "@invinite-org/chartlang-editor";
 *
 *     const editor = createChartlangEditor({
 *         parent: document.body,
 *         extensions: [editorFontSizeTheme(16)],
 *     });
 *     void editor;
 */
export function editorFontSizeTheme(fontSize: number): Extension {
    const lineHeight = `${Math.round(fontSize * 1.55)}px`;

    const fontSizeValue = `${fontSize}px`;

    return EditorView.theme({
        "&": {
            fontSize: fontSizeValue,
        },
        ".cm-scroller": {
            fontSize: fontSizeValue,
        },
        ".cm-content": {
            fontSize: fontSizeValue,
            lineHeight,
        },
        ".cm-line": {
            fontSize: fontSizeValue,
            lineHeight,
        },
        ".cm-gutters": {
            fontSize: fontSizeValue,
            lineHeight,
        },
        ".cm-gutterElement": {
            fontSize: fontSizeValue,
            lineHeight,
        },
    });
}
