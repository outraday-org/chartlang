// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { createChartlangEditor } from "./createChartlangEditor.js";
export {
    completionExtension,
    hoverExtension,
    linterExtension,
    peekPanelExtension,
} from "./extensions/index.js";
export { chartlangDark } from "./theme.js";
export { indentationExtension } from "./indentation.js";
export {
    editorFontSizeTheme,
    clampEditorFontSize,
    DEFAULT_EDITOR_FONT_SIZE,
    MIN_EDITOR_FONT_SIZE,
    MAX_EDITOR_FONT_SIZE,
    EDITOR_FONT_SIZE_PRESETS,
} from "./fontSize.js";
export type { ChartlangEditor, ChartlangEditorOpts } from "./types.js";
export type { ChartlangLanguageService } from "@invinite-org/chartlang-language-service";
