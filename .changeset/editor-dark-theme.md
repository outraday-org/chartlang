---
"@invinite-org/chartlang-editor": minor
---

Add a `chartlangDark` CodeMirror theme + syntax highlight extension tuned for dark UIs (One-Dark-inspired palette, harmonised with the react-demo chrome), and an `extensions` passthrough on `ChartlangEditorOpts` and the React `<ChartlangEditor>` wrapper. Consumer extensions are appended after the built-in editor extensions, so themes / read-only flags / custom keymaps override the `basicSetup` defaults. The React prop is read at mount time only (mirrors `service` semantics).
