# @invinite-org/chartlang-language-service

`experimental`

Headless editor intelligence for chartlang: diagnostics, completions, hover
docs, signature help, definitions, and interval-aware suggestions.

## Install

```bash
pnpm add @invinite-org/chartlang-language-service
```

## Public surface

| Export | Purpose |
|---|---|
| `createLanguageService(opts?)` | Builds a capability-aware service instance. |
| `compileToDiagnostics(source)` | Converts compiler diagnostics to LSP-style ranges. In browsers, inject `opts.compileToDiagnostics` so compilation runs outside the bundle. |
| `getCompletions(document, position)` | Returns core symbols and interval completions. |
| `getHoverDoc(document, position)` | Looks up generated hover docs from core JSDoc. |
| `getSignatureHelp(document, position)` | Returns call signatures for known symbols. |
| `getDefinition(document, position)` | Resolves generated source-location metadata. |
| `getAvailableIntervals()` | Reads intervals from target capabilities. |
| `HOVER_REGISTRY` | Checked-in generated hover-doc table. |

Dep-aware surfaces (Phase 0.7 indicator composition):
hovers + completions for `<binding>.output(...)` and
`<binding>.withInputs({...})` resolve same-file producer titles and
input schemas. The new `dep-*` compile diagnostics surface inline via
`compileToDiagnostics`. Go-to-definition on `.output("title")` jumps
to the producer's matching `plot(value, { title })` call.

## Minimum-viable API call

```ts
import { createLanguageService } from "@invinite-org/chartlang-language-service";

const service = createLanguageService({ targetCapabilities: capabilities });
const diagnostics = await service.compileToDiagnostics(source);
```

## Docs

See [`docs/reference/`](../../docs/reference/).

## License

MIT
