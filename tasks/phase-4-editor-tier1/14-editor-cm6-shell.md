# Task 14 — Editor: CM6 shell + Lezer TS grammar + extensions

> **Status: TODO**

## Goal

Promote `@invinite-org/chartlang-editor` from the
PACKAGE_VERSION placeholder to the framework-agnostic CodeMirror 6
reference shell per PLAN.md §14.2. Ship `createChartlangEditor(opts)`
plus the four CM6 extensions (syntax highlight, hover,
autocomplete, linter) that delegate to
`@invinite-org/chartlang-language-service`. React stays in the
`/react` sub-export (Task 15).

## Prerequisites

- Task 13 (language-service is the editor's hard dependency).

## Current Behavior

- `packages/editor/src/index.ts` exports only `PACKAGE_VERSION
  = "0.0.0"`.
- No CM6 dependency declared.
- No editor surface.

## Desired Behavior

- `import { createChartlangEditor } from "@invinite-org/chartlang-
  editor"` resolves to a factory that takes:
  ```ts
  type ChartlangEditorOpts = Readonly<{
      doc?: string;
      targetCapabilities?: Capabilities;
      onSourceChange?: (next: string) => void;
      onCompiled?: (compiled: CompiledScriptObject) => void;
  }>;

  type ChartlangEditor = Readonly<{
      view: EditorView;
      destroy(): void;
      setSource(source: string): void;
      setCapabilities(caps: Capabilities | null): void;
  }>;
  ```
- Mount: `const ed = createChartlangEditor({ doc: source, …,
  parent: containerElement });` (`parent` optional — caller may
  attach `ed.view.dom` themselves).
- Lezer TypeScript grammar wires syntax highlighting. The TS
  grammar is shared with CM6's `@codemirror/lang-javascript`
  package; we pin `typescript: true` flag.
- Hover extension calls `languageService.getHoverDoc(source,
  offset)` and renders into a CM6 tooltip with a
  monospace-rendered title + JSDoc summary.
- Autocomplete extension calls
  `languageService.getCompletions(source, offset)` on every
  trigger character.
- Linter extension calls `languageService.compileToDiagnostics
  (source)` debounced (250 ms) on every doc change. Renders
  squiggles + a gutter pin per diagnostic.
- A "peek panel" CM6 widget shows emitted plots / drawings /
  alerts when the caller provides a `previewRunner` (Phase 5+
  feature — the panel ships with a placeholder in Phase 4).

## Requirements

### 1. `packages/editor/package.json` — dependencies

Add (peer or runtime per CM6 norms):

```json
{
  "dependencies": {
    "codemirror": "^6",
    "@codemirror/state": "^6",
    "@codemirror/view": "^6",
    "@codemirror/lang-javascript": "^6",
    "@codemirror/lint": "^6",
    "@codemirror/autocomplete": "^6",
    "@codemirror/commands": "^6",
    "@codemirror/language": "^6",
    "@codemirror/search": "^6",
    "@invinite-org/chartlang-language-service": "workspace:*",
    "@invinite-org/chartlang-core": "workspace:*",
    "@invinite-org/chartlang-adapter-kit": "workspace:*"
  }
}
```

The bare `codemirror` meta-package is required because
`createChartlangEditor.ts` imports `{ EditorView, basicSetup }
from "codemirror"`. The individual `@codemirror/*` deps cover the
extension implementations.

### 2. `packages/editor/src/createChartlangEditor.ts`

```ts
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { createLanguageService } from "@invinite-org/chartlang-language-service";
import { hoverExtension } from "./extensions/hover";
import { completionExtension } from "./extensions/completion";
import { linterExtension } from "./extensions/linter";

export function createChartlangEditor(opts: ChartlangEditorOpts = {}): ChartlangEditor {
    let svc = createLanguageService({ targetCapabilities: opts.targetCapabilities });

    const state = EditorState.create({
        doc: opts.doc ?? "",
        extensions: [
            basicSetup,
            javascript({ typescript: true }),
            hoverExtension(() => svc),
            completionExtension(() => svc),
            linterExtension(() => svc, opts.onCompiled),
            EditorView.updateListener.of((u) => {
                if (u.docChanged) opts.onSourceChange?.(u.state.doc.toString());
            }),
        ],
    });
    const view = new EditorView({ state, parent: opts.parent });

    return Object.freeze({
        view,
        destroy: () => view.destroy(),
        setSource: (source: string) => {
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
        },
        setCapabilities: (caps) => {
            svc = createLanguageService({ targetCapabilities: caps ?? undefined });
        },
    });
}
```

### 3. Extension files

- `packages/editor/src/extensions/hover.ts` — CM6 `hoverTooltip`
  factory; reads cursor offset, calls `getHoverDoc`, returns
  rendered HTML.
- `packages/editor/src/extensions/completion.ts` — CM6
  `autocompletion` source delegating to `getCompletions`.
- `packages/editor/src/extensions/linter.ts` — CM6 `linter` with
  debounce; converts `LspDiagnostic` to CM6 `Diagnostic` shape.
- `packages/editor/src/extensions/peekPanel.ts` — placeholder
  panel showing "preview unavailable in Phase 4" until a Phase-5+
  `previewRunner` is wired.

### 4. `packages/editor/src/index.ts` — public surface

```ts
export { createChartlangEditor } from "./createChartlangEditor";
export type { ChartlangEditor, ChartlangEditorOpts } from "./types";
```

### 5. Tests

CM6 needs a DOM. Use `happy-dom` (already in the workspace as
`vitest` dep) for tests.

- **`createChartlangEditor.test.ts`** — mount editor on a
  detached `div`, verify:
  - `setSource("ta.ema(...)")` updates the doc.
  - `onSourceChange` fires on edit.
  - `setCapabilities(null)` clears interval completions.
  - `destroy()` removes the view.
- **`hover.test.ts`** — fire a synthetic mousemove over a
  symbol position; assert the tooltip widget renders.
- **`completion.test.ts`** — trigger autocomplete at an
  identifier position; assert the completion items match
  `getCompletions` output.
- **`linter.test.ts`** — feed an erroring source; await
  debounce; assert the gutter pin renders.
- **`peekPanel.test.ts`** — assert the placeholder text renders.

### 6. JSDoc gate

Every export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/editor/package.json` | Modify | Add CM6 deps |
| `packages/editor/src/createChartlangEditor.ts` | Create | Factory |
| `packages/editor/src/types.ts` | Create | `ChartlangEditor` + opts |
| `packages/editor/src/extensions/hover.ts` | Create | CM6 hover extension |
| `packages/editor/src/extensions/completion.ts` | Create | CM6 autocompletion |
| `packages/editor/src/extensions/linter.ts` | Create | CM6 linter |
| `packages/editor/src/extensions/peekPanel.ts` | Create | Placeholder panel |
| `packages/editor/src/extensions/index.ts` | Create | Barrel |
| `packages/editor/src/index.ts` | Replace | Real public surface |
| `packages/editor/src/createChartlangEditor.test.ts` | Create | Factory tests |
| `packages/editor/src/extensions/*.test.ts` | Create | Per-extension tests |
| `packages/editor/vitest.config.ts` | Modify | Add `happy-dom` env |

## Edge Cases

- **No React import** — the bare entry is framework-agnostic.
  React lives in `/react` (Task 15). Any React reference in this
  task is a bug.
- **Lezer grammar** — `@codemirror/lang-javascript`'s TS mode
  covers chartlang's TypeScript subset. We don't fork; we
  configure with `typescript: true`. Custom highlighting for
  `ta.*` / `state.*` / etc. lands later via
  `syntaxHighlighting` style overrides.
- **Linter debounce** — 250 ms feels right for compile-on-keystroke;
  expose as `opts.lintDebounceMs?: number` defaulting to 250.
- **Capability hot-swap** — `setCapabilities()` rebuilds the
  language service; existing CM6 extensions read the live
  reference via the `() => svc` getter, so the swap takes effect
  on the next keystroke without a full re-mount.
- **`createLanguageService` is stateless** — rebuilding per
  capability change is cheap (no compiler instance reuse needed
  in Phase 4; Phase 5 may add an instance cache).
- **DOM-only** — the package does NOT run on Node. Tests run
  under `happy-dom`. Document this in the README.
- **`pnpm test` coverage** — CM6 extensions exercise both
  branches via synthetic events. Some lines (event handlers
  that only run inside a CM6 internal dispatch loop) may need
  helper test utilities; see CM6's own test utils for the
  pattern.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage on
  `@invinite-org/chartlang-editor`),
  `pnpm docs:check`, `pnpm readme:check`.

## Changeset

`.changeset/phase-4-task-14-editor-cm6-shell.md` — **minor** on
`@invinite-org/chartlang-editor` (first real release).

## Acceptance Criteria

- `createChartlangEditor({ doc, targetCapabilities })` mounts a
  working CM6 editor with TS highlighting.
- Hover, autocomplete, lint extensions render against a
  live `@invinite-org/chartlang-language-service` instance.
- Capability hot-swap re-wires the interval completion source.
- 100% coverage on the package.
- README + JSDoc gates green.
- Changeset committed.
