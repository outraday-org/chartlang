# packages/editor/

`@invinite-org/chartlang-editor` — the CodeMirror 6 reference editor over
`@invinite-org/chartlang-language-service`, plus React bindings at `/react`.

## Invariants

- **The factory never constructs a language service.** `createChartlangEditor`
  mounts a browser-safe CM6 shell unless the consumer injects
  `opts.service`; every intelligence extension is gated on that. Do not
  reintroduce an internal `createLanguageService()` call — it drags the
  Node-only compiler graph into the browser bundle. `opts.targetCapabilities`
  and `editor.setCapabilities()` survive only as deprecated no-ops; capability
  filtering belongs to `createLanguageService({ targetCapabilities })`, so an
  extension must never re-filter.

- **`peekPanelExtension` is the PREVIEW panel, not definition-peek.** Its class
  is `.chartlang-peek-panel`, it is mounted only by `previewPanelExtensions()`
  when `previewPanel: true` / `previewRunner` is supplied, and go-to-definition
  has nothing to do with it. Never overload it.

- **Go-to-definition has two arms, and only one of them is a jump.**
  `service.getDefinition` resolves a `<binding>.output("title")` accessor to a
  REAL in-document position, and a stdlib symbol to a placeholder
  `{ file: "packages/core/dist/index.d.ts", line: 1, column: 1 }` that names no
  file a browser bundle can open. `definition.ts` jumps for the first and falls
  back to rendering the symbol's hover doc for the second. Do not build a peek
  over the placeholder. The in-document discriminant is
  `location.file === DEFAULT_SCRIPT_FILE_NAME` (overridable via
  `DefinitionExtensionOpts.scriptFileName`) — the language service does not
  export its own script file name. See `packages/language-service/CLAUDE.md`.

- **Extensions that need hover markup reuse `renderHoverDoc` from `hover.ts`.**
  One renderer, two surfaces (hover tooltip + the definition fallback). Do not
  fork a second DOM builder.

- **Default-extension flags follow the `=== false` idiom.** `indentation`,
  `signatureHelp`, and `definition` are all default-ON and opt out with an
  explicit `false`; `previewPanel` is default-OFF and opts in with `true`. The
  React `ChartlangEditorProps` is a deliberate SUBSET of `ChartlangEditorOpts`
  (no `lintDebounceMs`, `indentation`, `signatureHelp`, `definition`) — the
  defaults reach React consumers without a prop.

## Testing

- vitest runs under `happy-dom`, which has **no layout engine**. Any code path
  through `view.posAtCoords` / `posAndSideAtCoords` throws there, so the
  modifier-click tests pin `posAtCoords` on the view instance. The mousedown
  handler consumes a modifier-click unconditionally (returns `true` even when
  nothing resolves) so CodeMirror's own layout-dependent drag-selection never
  runs behind it — that is behaviour, not a test workaround.
- `vitest.config.ts` excludes `src/**/index.ts` and `src/**/types.ts` from
  coverage; everything else is at the 100% line/branch/function gate.
