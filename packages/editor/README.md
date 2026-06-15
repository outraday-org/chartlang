# @invinite-org/chartlang-editor

`experimental`

Framework-agnostic CodeMirror 6 reference editor over
`@invinite-org/chartlang-language-service`, plus React bindings at `/react`.

## Install

```bash
pnpm add @invinite-org/chartlang-editor
```

## Public surface

### Bare entry — `@invinite-org/chartlang-editor`

| Export | Purpose |
|---|---|
| `createChartlangEditor(opts)` | Mounts the browser-safe CM6 editor shell. Accepts `opts.service` to inject a custom `ChartlangLanguageService` for hover, completions, and diagnostics. |
| `ChartlangLanguageService` (type) | Re-exported language-service shape; pass any conforming object to `opts.service`. |
| `chartlangDark` | Built-in dark CodeMirror theme (also available from `/theme`). |
| `hoverExtension(getService)` | Language-service hover integration. |
| `completionExtension(getService)` | Completion source, including intervals. |
| `linterExtension(getService, onCompiled?, debounceMs?)` | Async diagnostics with gutter. |
| `peekPanelExtension(previewRunner?)` | Phase 4 preview-panel placeholder. |

### Subpath entries

| Entry | Purpose |
|---|---|
| `@invinite-org/chartlang-editor/theme` | Browser-safe theme-only entry. Exports `chartlangDark` without pulling the editor factory or any language-service surface into the bundle. |
| `@invinite-org/chartlang-editor/language-service` | Opt-in `createLanguageService(...)` and language-service types. Importing this entry does not load the compiler, but calling `compileToDiagnostics(...)` lazy-loads the compiler path for local diagnostics. |
| `@invinite-org/chartlang-editor/react` | React bindings — `ChartlangEditor`, `InputsForm`, `renderInputsForm`. |

Capability-aware editor intelligence is service-owned. To use
`targetCapabilities`, create a language service and inject it:

```ts
import { createChartlangEditor } from "@invinite-org/chartlang-editor";
import { createLanguageService } from "@invinite-org/chartlang-editor/language-service";

const editor = createChartlangEditor({
    parent,
    doc,
    service: createLanguageService({ targetCapabilities }),
});
```

## Minimum-viable API call

```ts
import { createChartlangEditor } from "@invinite-org/chartlang-editor";

const editor = createChartlangEditor({
    parent,
    doc: "export default defineIndicator({ name: 'x', apiVersion: 1, compute: () => {} });",
});

editor.destroy();
```

## Docs

See [`docs/getting-started/embed-in-our-chart.md`](../../docs/getting-started/embed-in-our-chart.md).

## License

MIT
