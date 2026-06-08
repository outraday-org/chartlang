# @invinite-org/chartlang-editor

`experimental`

Framework-agnostic CodeMirror 6 reference editor over
`@invinite-org/chartlang-language-service`, plus React bindings at `/react`.

## Install

```bash
pnpm add @invinite-org/chartlang-editor
```

## Public surface

| Export | Purpose |
|---|---|
| `createChartlangEditor(opts)` | Mounts the CM6 editor shell. |
| `hoverExtension(getService)` | Language-service hover integration. |
| `completionExtension(getService)` | Completion source, including intervals. |
| `linterExtension(getService, onCompiled?, debounceMs?)` | Async diagnostics with gutter. |
| `peekPanelExtension(previewRunner?)` | Phase 4 preview-panel placeholder. |

The bare entry stays React-free. React hosts import
`@invinite-org/chartlang-editor/react` for:

- `ChartlangEditor`
- `renderInputsForm(manifest, value, onChange, capabilities?)`
- `InputsForm`

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
