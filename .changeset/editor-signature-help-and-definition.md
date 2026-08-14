---
"@invinite-org/chartlang-editor": minor
---

Add two language-service-backed CodeMirror extensions.

`signatureHelpExtension(getService)` renders a cursor-following tooltip from
`service.getSignatureHelp` — the primitive's label plus its parameter list with
the active parameter highlighted. It recomputes only on document or selection
changes, and never re-filters by capability (the injected service is already
filtered by `createLanguageService({ targetCapabilities })`).

`definitionExtension(getService, opts?)` binds go-to-definition to Cmd/Ctrl-click
and `F12`. `service.getDefinition` resolves two different kinds of target and the
extension treats them differently: a `<binding>.output("title")` dependency
accessor resolves to a real in-document position, so the extension **jumps**
there; a stdlib symbol resolves to a placeholder declaration path that does not
exist in a browser bundle, so the extension **shows that symbol's hover doc**
instead of peeking an empty file. `DefinitionExtensionOpts.scriptFileName`
(default `"script.chart.ts"`) is the in-document discriminant. A modifier-click
is consumed even when nothing resolves, so it never falls through to
drag-selection.

Both are exported from the package barrel and are wired into
`createChartlangEditor`'s default extension set **default-on**, matching hover
and completions — they mount whenever `opts.service` is injected. Opt out per
editor with `signatureHelp: false` / `definition: false`.

The barrel also gains `DEFAULT_SCRIPT_FILE_NAME` and the
`DefinitionExtensionOpts` type. The hover markup builder is now shared between
the hover tooltip and the definition fallback rather than duplicated.
