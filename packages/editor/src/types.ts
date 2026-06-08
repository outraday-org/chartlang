// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { EditorView } from "codemirror";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";

/**
 * Options accepted by the framework-agnostic CodeMirror editor factory.
 *
 * @since 0.4
 * @stable
 * @example
 *     const opts: ChartlangEditorOpts = { doc: "export default {};" };
 *     void opts;
 */
export type ChartlangEditorOpts = Readonly<{
    doc?: string;
    parent?: HTMLElement;
    targetCapabilities?: Capabilities;
    onSourceChange?: (next: string) => void;
    onCompiled?: (compiled: CompiledScriptObject) => void;
    lintDebounceMs?: number;
    previewRunner?: unknown;
}>;

/**
 * Mounted CodeMirror editor instance returned by `createChartlangEditor()`.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const editor: ChartlangEditor;
 *     editor.setSource("const value = 1;");
 */
export type ChartlangEditor = Readonly<{
    view: EditorView;
    destroy(): void;
    setSource(source: string): void;
    setCapabilities(caps: Capabilities | null): void;
}>;
