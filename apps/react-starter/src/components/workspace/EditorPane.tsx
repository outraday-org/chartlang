// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Left half of the workspace. Renders the React `<ChartlangEditor>` with the
// hybrid service injected via `opts.service`, so the editor compiles through
// the `/api/compile` server route instead of the in-browser compiler (which
// would crash through the esbuild stub). The linter extension drives that
// compile on a built-in debounce (`lintDebounceMs`), and the hybrid service's
// observer side-channel hands the resulting artifact to the chart.
//
// THEME: unlike apps/site (which composes `chartlangDark` for the brand), the
// starter passes NO theme extension so CodeMirror's `basicSetup` default
// (light) theme renders — that matches the stock shadcn neutral palette this
// starter ships. The editor surface is sized to fill its flex pane via the
// `.cm-editor` rule in src/styles.css. Re-theme freely (drop a CodeMirror
// theme extension into EDITOR_EXTENSIONS) when re-skinning the clone.
//
// The React `<ChartlangEditor>` wrapper does not expose `lintDebounceMs`, so
// the compile debounce stays at the editor's built-in default (the linter
// already debounces `compileToDiagnostics`; typing never floods /api/compile).

import { ChartlangEditor } from "@invinite-org/chartlang-editor/react"
import { type ComponentProps, type ReactElement } from "react"

import type { createHybridLanguageService } from "./hybridLanguageService"

type LanguageService = ReturnType<typeof createHybridLanguageService>

// Reuse the editor's own `extensions` prop type so we don't add a direct
// `@codemirror/state` dependency just for `Extension`.
type EditorExtensions = NonNullable<ComponentProps<typeof ChartlangEditor>["extensions"]>

// Hoisted so the prop identity stays stable across re-renders (the editor
// reads `extensions` at mount time only). Empty = CodeMirror's light default.
const EDITOR_EXTENSIONS: EditorExtensions = []

/**
 * Props for {@link EditorPane}. The hybrid language service injects a
 * server-backed `compileToDiagnostics` while keeping the local service for
 * the pure-TS surface (hover, completions, signature help, intervals).
 */
export type EditorPaneProps = Readonly<{
  initialSource: string
  service: LanguageService
  onSourceChange: (next: string) => void
}>

/**
 * The editor pane. `onSourceChange` tracks the buffer text (for the dirty
 * indicator + save); the compile→chart flow rides the linter + the hybrid
 * service's observer, not this callback.
 */
export function EditorPane(props: EditorPaneProps): ReactElement {
  return (
    <ChartlangEditor
      className="h-full overflow-hidden"
      extensions={EDITOR_EXTENSIONS}
      onSourceChange={props.onSourceChange}
      service={props.service}
      source={props.initialSource}
    />
  )
}
