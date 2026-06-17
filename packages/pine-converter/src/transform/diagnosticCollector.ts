// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic, SourceSpan } from "../index.js";
import { type ParserDiagnosticCode, makeDiagnostic } from "../diagnostics/codes.js";

/**
 * The single mutable diagnostic accumulator the transform layer (Tasks
 * 8–15) shares. Earlier passes (parse / semantic / coordinates) each return
 * their diagnostics in a result object; the `void`-returning transforms that
 * mutate a {@link import("./ir.js").ScriptScaffold} need a place to push
 * into instead. Construct one per conversion, hand it to every transform,
 * then drain it with {@link DiagnosticCollector.toArray} when codegen runs.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const diagnostics = new DiagnosticCollector();
 *     diagnostics.pushCode("strategy-as-indicator", {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 1,
 *     });
 *     diagnostics.toArray().length; // 1
 */
export class DiagnosticCollector {
    private readonly items: Diagnostic[] = [];
    private readonly codes = new Set<string>();

    /**
     * Append an already-built {@link Diagnostic} (e.g. a diagnostic returned
     * by an upstream pass that this transform wants to merge in).
     *
     * @since 0.1
     * @experimental
     * @example
     *     const diagnostics = new DiagnosticCollector();
     *     diagnostics.push({
     *         code: "pine-converter/transform/x",
     *         severity: "info",
     *         message: "m",
     *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
     *     });
     *     void diagnostics;
     */
    public push(diagnostic: Diagnostic): void {
        this.items.push(diagnostic);
        this.codes.add(diagnostic.code);
    }

    /**
     * Build and append a {@link Diagnostic} from a registry key, span, and
     * optional message override — the transform-layer analogue of the
     * parser's `makeDiagnostic`. The stable code, severity, and default
     * suggestion come from the diagnostic registry.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const diagnostics = new DiagnosticCollector();
     *     diagnostics.pushCode("computed-indicator-title", {
     *         startLine: 2,
     *         startColumn: 1,
     *         endLine: 2,
     *         endColumn: 30,
     *     });
     *     diagnostics.has("pine-converter/transform/computed-indicator-title"); // true
     */
    public pushCode(key: ParserDiagnosticCode, span: SourceSpan, messageOverride?: string): void {
        this.push(makeDiagnostic(key, span, messageOverride));
    }

    /**
     * Whether any diagnostic with the given stable code string has been
     * pushed. Lets a transform de-dupe a once-per-script diagnostic.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const diagnostics = new DiagnosticCollector();
     *     diagnostics.has("pine-converter/transform/x"); // false
     */
    public has(code: string): boolean {
        return this.codes.has(code);
    }

    /**
     * The number of diagnostics accumulated so far.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const diagnostics = new DiagnosticCollector();
     *     diagnostics.size; // 0
     */
    public get size(): number {
        return this.items.length;
    }

    /**
     * A snapshot copy of the accumulated diagnostics in push order. Codegen
     * (Task 16) drains this into the public `ConvertResult.diagnostics`.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const diagnostics = new DiagnosticCollector();
     *     diagnostics.toArray(); // []
     */
    public toArray(): readonly Diagnostic[] {
        return [...this.items];
    }
}
