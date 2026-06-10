// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { IntervalDescriptor } from "@invinite-org/chartlang-core";

/**
 * One-based editor range used by language-service diagnostics.
 *
 * @since 0.4
 * @stable
 * @example
 *     const range: LspRange = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 };
 *     void range;
 */
export type LspRange = Readonly<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}>;

/**
 * Diagnostic severity values consumed by editor adapters.
 *
 * @since 0.4
 * @stable
 * @example
 *     const severity: LspSeverity = "warning";
 *     void severity;
 */
export type LspSeverity = "error" | "warning" | "info" | "hint";

/**
 * LSP-shaped diagnostic emitted by the headless language service.
 *
 * @since 0.4
 * @stable
 * @example
 *     const diagnostic: LspDiagnostic = {
 *         range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         severity: "error",
 *         code: "unbounded-loop",
 *         message: "while loops are not allowed",
 *     };
 *     void diagnostic;
 */
export type LspDiagnostic = Readonly<{
    range: LspRange;
    severity: LspSeverity;
    code: string;
    message: string;
    relatedCallsite?: string;
}>;

/**
 * Hover payload rendered by editor integrations.
 *
 * @since 0.4
 * @stable
 * @example
 *     const hover: HoverDoc = { title: "ta.ema(source, length)", summary: "EMA." };
 *     void hover;
 */
export type HoverDoc = Readonly<{
    title: string;
    summary: string;
    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;
    examples?: ReadonlyArray<string>;
}>;

/**
 * Completion item returned by the language-service completion source.
 *
 * @since 0.4
 * @stable
 * @example
 *     const item: CompletionItem = {
 *         label: "ta.ema",
 *         kind: "function",
 *         insertText: "ta.ema",
 *     };
 *     void item;
 */
export type CompletionItem = Readonly<{
    label: string;
    kind: "function" | "namespace" | "property" | "enumMember" | "keyword";
    insertText: string;
    detail?: string;
    doc?: HoverDoc;
}>;

/**
 * Signature-help payload for primitive calls.
 *
 * @since 0.4
 * @stable
 * @example
 *     const help: SignatureHelp = {
 *         label: "request.security(opts)",
 *         parameters: [{ name: "opts", doc: "Request options." }],
 *         activeParameter: 0,
 *     };
 *     void help;
 */
export type SignatureHelp = Readonly<{
    label: string;
    parameters: ReadonlyArray<{ name: string; doc: string }>;
    activeParameter: number;
}>;

/**
 * Definition target for primitive jump-to-definition.
 *
 * @since 0.4
 * @stable
 * @example
 *     const location: DefinitionLocation = {
 *         file: "packages/core/dist/index.d.ts",
 *         line: 1,
 *         column: 1,
 *     };
 *     void location;
 */
export type DefinitionLocation = Readonly<{
    file: string;
    line: number;
    column: number;
}>;

/**
 * Options accepted by the language-service factory.
 *
 * @since 0.4
 * @stable
 * @example
 *     const opts: LanguageServiceOptions = {};
 *     void opts;
 */
export type LanguageServiceOptions = Readonly<{
    targetCapabilities?: Capabilities;
}>;

/**
 * Headless language-service surface consumed by the editor extensions
 * and any embedding consumer. The {@link createLanguageService} factory
 * returns a value of this exact shape; consumers can also supply their
 * own implementation (for example a server-backed `compileToDiagnostics`
 * that POSTs to a build endpoint) and inject it into
 * `createChartlangEditor` via `opts.service`.
 *
 * @since 0.4
 * @stable
 * @example
 *     const stub: ChartlangLanguageService = {
 *         compileToDiagnostics: async () => [],
 *         getHoverDoc: () => null,
 *         getCompletions: () => [],
 *         getSignatureHelp: () => null,
 *         getDefinition: () => null,
 *         getAvailableIntervals: () => [],
 *     };
 *     void stub;
 */
export type ChartlangLanguageService = Readonly<{
    compileToDiagnostics(source: string): Promise<ReadonlyArray<LspDiagnostic>>;
    getHoverDoc(source: string, offset: number): HoverDoc | null;
    getCompletions(source: string, offset: number): ReadonlyArray<CompletionItem>;
    getSignatureHelp(source: string, offset: number): SignatureHelp | null;
    getDefinition(source: string, offset: number): DefinitionLocation | null;
    getAvailableIntervals(): ReadonlyArray<IntervalDescriptor>;
}>;
