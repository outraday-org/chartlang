// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { chartlangDark } from "@invinite-org/chartlang-editor";
import { ChartlangEditor } from "@invinite-org/chartlang-editor/react";
import { type ReactElement } from "react";

import type { createHybridLanguageService } from "./hybridLanguageService";

type LanguageService = ReturnType<typeof createHybridLanguageService>;

// Hoisted to module scope so the prop identity stays stable across
// re-renders — the editor only reads `extensions` at mount time, but a
// stable reference avoids confusing future maintainers who might assume
// otherwise.
const EDITOR_EXTENSIONS = [chartlangDark];

/**
 * Props for {@link EditorPane}. The hybrid language service injects
 * a server-backed `compileToDiagnostics` while keeping the local
 * service for the pure-TS surface (hover, completions, signature
 * help, definitions, intervals).
 */
export type EditorPaneProps = Readonly<{
    initialSource: string;
    service: LanguageService;
    onSourceChange: (next: string) => void;
}>;

/**
 * Left half of the demo. Renders the React `<ChartlangEditor>` with
 * the hybrid service injected via `opts.service`, so the editor uses
 * the demo's `/api/compile` endpoint instead of the in-browser
 * compiler (which would crash through the esbuild stub on first
 * compile).
 */
export function EditorPane(props: EditorPaneProps): ReactElement {
    return (
        <ChartlangEditor
            className="editor-pane"
            extensions={EDITOR_EXTENSIONS}
            onSourceChange={props.onSourceChange}
            service={props.service}
            source={props.initialSource}
        />
    );
}
