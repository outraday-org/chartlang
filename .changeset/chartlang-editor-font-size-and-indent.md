---
"@invinite-org/chartlang-editor": minor
---

Add editor font-size control (`opts.fontSize`, `editor.setFontSize()`, the
reactive `<ChartlangEditor fontSize>` prop, `editorFontSizeTheme`, and the
`DEFAULT_/MIN_/MAX_EDITOR_FONT_SIZE` + `EDITOR_FONT_SIZE_PRESETS` +
`clampEditorFontSize` helpers) and bake in the chartlang Tab/auto-indent
keymap (`indentationExtension`, on by default, opt out with
`opts.indentation: false`).
