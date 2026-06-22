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
// THEME: the editor follows the app's shadcn light/dark mode — `chartlangDark`
// (from the editor package) in dark mode, the starter-local `chartlangLight`
// in light mode. Both are composed as the last extension so they override
// `basicSetup`'s default theme. The React `<ChartlangEditor>` reads
// `extensions` at MOUNT time only, so the caller (index.tsx) folds the theme
// into the editor's `key` to remount on a toggle; because index passes the
// live buffer as `initialSource`, the remount preserves the user's edits. The
// editor surface is sized to fill its flex pane via the `.cm-editor` rule in
// src/styles.css.
//
// The React `<ChartlangEditor>` wrapper does not expose `lintDebounceMs`, so
// the compile debounce stays at the editor's built-in default (the linter
// already debounces `compileToDiagnostics`; typing never floods /api/compile).

import { chartlangDark } from "@invinite-org/chartlang-editor"
import { ChartlangEditor } from "@invinite-org/chartlang-editor/react"
import { type ComponentProps, type ReactElement } from "react"

import { chartlangLight } from "./editorTheme"
import type { createHybridLanguageService } from "./hybridLanguageService"

type LanguageService = ReturnType<typeof createHybridLanguageService>

// Reuse the editor's own `extensions` prop type so we don't add a direct
// `@codemirror/state` dependency just for `Extension`.
type EditorExtensions = NonNullable<ComponentProps<typeof ChartlangEditor>["extensions"]>

// Hoisted so the prop identity stays stable across re-renders (the editor
// reads `extensions` at mount time only; a remount on theme change is driven
// by the editor `key` in index.tsx).
const DARK_EXTENSIONS: EditorExtensions = [chartlangDark]
const LIGHT_EXTENSIONS: EditorExtensions = [chartlangLight]

/**
 * Props for {@link EditorPane}. The hybrid language service injects a
 * server-backed `compileToDiagnostics` while keeping the local service for
 * the pure-TS surface (hover, completions, signature help, intervals).
 */
export type EditorPaneProps = Readonly<{
  initialSource: string
  service: LanguageService
  onSourceChange: (next: string) => void
  /** Resolved app theme; selects the CodeMirror theme extension. */
  theme: "light" | "dark"
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
      extensions={props.theme === "dark" ? DARK_EXTENSIONS : LIGHT_EXTENSIONS}
      onSourceChange={props.onSourceChange}
      service={props.service}
      source={props.initialSource}
    />
  )
}
