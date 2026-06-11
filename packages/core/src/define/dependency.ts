// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types.js";

/**
 * One titled output a script exposes for consumption by other
 * indicators. Derived from the producer's `plot(value, { title })`
 * calls during compile. `title` is the key consumers reference via
 * `<binding>.output("title")`.
 *
 * @since 0.7
 * @stable
 * @example
 *     const out: OutputDeclaration = {
 *         title: "line",
 *         kind: "series-number",
 *     };
 *     void out;
 */
export type OutputDeclaration = Readonly<{
    readonly title: string;
    readonly kind: "series-number";
}>;

/**
 * One node in a script's compiled dependency graph. Emitted by the
 * compiler's `extractDependencyGraph` pass (Task 2) and consumed by
 * the runtime's dep executor (Task 4).
 *
 * `localId` is the JavaScript binding name the consumer used —
 * `const trend = baseTrend.withInputs(...)` produces
 * `localId: "trend"`. Stable across script edits as long as the
 * binding name is stable.
 *
 * `producerSourcePath` is the POSIX path the compiler resolved for
 * the producer. Same-file deps use the consumer's `sourcePath`.
 *
 * `effectiveInputs` is the merge of producer defaults + every
 * `.withInputs(...)` chained on the binding, JSON-serialised.
 *
 * `outputs` mirrors the producer's `ScriptManifest.outputs` so the
 * runtime can validate consumer `.output("...")` calls at mount time.
 *
 * @since 0.7
 * @stable
 * @example
 *     const dep: DependencyDeclaration = {
 *         localId: "fastTrend",
 *         producerName: "Base Trend",
 *         producerSourcePath: "trend-confirmation.chart.ts",
 *         producerExportName: "default",
 *         effectiveInputs: { length: 20 },
 *         outputs: [{ title: "line", kind: "series-number" }],
 *         isDrawn: false,
 *     };
 *     void dep;
 */
export type DependencyDeclaration = Readonly<{
    readonly localId: string;
    readonly producerName: string;
    readonly producerSourcePath: string;
    readonly producerExportName: string;
    readonly effectiveInputs: Readonly<Record<string, JsonValue>>;
    readonly outputs: ReadonlyArray<OutputDeclaration>;
    readonly isDrawn: boolean;
}>;
