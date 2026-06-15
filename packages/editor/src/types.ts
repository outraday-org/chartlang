// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Extension } from "@codemirror/state";
import type { EditorView } from "codemirror";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";
import type { ChartlangLanguageService } from "@invinite-org/chartlang-language-service";

/**
 * Options accepted by the framework-agnostic CodeMirror editor factory.
 *
 * `service` injects a consumer-provided {@link ChartlangLanguageService}.
 * The factory never constructs an internal service, so hover,
 * completions, diagnostics, and capability-aware interval suggestions are
 * available only when a service is supplied. Browser consumers who
 * compile server-side use this seam to wire a hybrid service (local hover
 * / completions, remote `compileToDiagnostics`).
 *
 * `extensions` is a passthrough seam for arbitrary CodeMirror extensions
 * (themes, keymaps, read-only flags, custom highlight styles). The list
 * is appended at the END of the built-in extension array so consumer
 * extensions win over `basicSetup` defaults. Read at mount time only —
 * later changes do not re-mount the editor.
 *
 * @since 0.5
 * @stable
 * @example
 *     const opts: ChartlangEditorOpts = { doc: "export default {};" };
 *     void opts;
 */
export type ChartlangEditorOpts = Readonly<{
    doc?: string;
    parent?: HTMLElement;
    /**
     * @deprecated Browser-safe editor entries no longer construct a
     * language service internally. Create a service with
     * `createLanguageService({ targetCapabilities })` and pass it via
     * `service`.
     */
    targetCapabilities?: Capabilities;
    service?: ChartlangLanguageService;
    onSourceChange?: (next: string) => void;
    onCompiled?: (compiled: CompiledScriptObject) => void;
    lintDebounceMs?: number;
    previewRunner?: unknown;
    extensions?: ReadonlyArray<Extension>;
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
    /**
     * @deprecated No-op. Capability updates belong to the injected
     * language service.
     */
    setCapabilities(caps: Capabilities | null): void;
}>;
