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
| `compileToDiagnostics(source, opts)` | Converts compiler diagnostics to LSP-style ranges. |
| `getCompletions(document, position)` | Returns core symbols and interval completions. |
| `getHoverDoc(document, position)` | Looks up generated hover docs from core JSDoc. |
| `getSignatureHelp(document, position)` | Returns call signatures for known symbols. |
| `getDefinition(document, position)` | Resolves generated source-location metadata. |
| `getAvailableIntervals()` | Reads intervals from target capabilities. |
| `HOVER_REGISTRY` | Checked-in generated hover-doc table. |

## Minimum-viable API call

```ts
import { createLanguageService } from "@invinite-org/chartlang-language-service";

const service = createLanguageService({ targetCapabilities: capabilities });
const diagnostics = service.compileToDiagnostics(source, {
    apiVersion: 1,
    sourcePath: "demo.chart.ts",
});
```

## Docs

See [`docs/reference/`](../../docs/reference/).

## License

MIT
