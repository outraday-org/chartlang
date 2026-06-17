// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";

/**
 * Upgrade every `warning`-severity diagnostic to `error`, leaving `error` and
 * `info` diagnostics untouched. Pure — returns a fresh array; the input is not
 * mutated. This is the building block `convert(source, { strictMode: true })`
 * applies so a strict caller sees warnings as errors in
 * `ConvertResult.diagnostics`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const upgraded = upgradeWarningsToErrors([
 *         {
 *             code: "pine-converter/transform/cap-mismatch",
 *             severity: "warning",
 *             message: "m",
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *     ]);
 *     upgraded[0]?.severity; // "error"
 */
export function upgradeWarningsToErrors(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
    return diagnostics.map((diagnostic) =>
        diagnostic.severity === "warning" ? { ...diagnostic, severity: "error" } : diagnostic,
    );
}

/**
 * A read-only view over an assembled `readonly Diagnostic[]` that partitions
 * by severity and renders a strict-mode upgrade. It is DISTINCT from the
 * transform-layer `DiagnosticCollector` (a mutable push sink the transform
 * passes share): the collector accumulates during conversion, the report is
 * the immutable read/format side the CLI (Task 18) consumes. Construct one
 * from `ConvertResult.diagnostics`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const report = new DiagnosticReport(result.diagnostics);
 *     report.errors().length; // count of error-severity diagnostics
 */
export class DiagnosticReport {
    private readonly diagnostics: readonly Diagnostic[];

    /**
     * Wrap an assembled diagnostic list. The list is copied so later mutation
     * of the caller's array cannot leak into the report.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const report = new DiagnosticReport([]);
     *     report.all().length; // 0
     */
    public constructor(diagnostics: readonly Diagnostic[]) {
        this.diagnostics = [...diagnostics];
    }

    /**
     * The `error`-severity diagnostics, in original order.
     *
     * @since 0.1
     * @experimental
     * @example
     *     new DiagnosticReport([]).errors(); // []
     */
    public errors(): readonly Diagnostic[] {
        return this.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
    }

    /**
     * The `warning`-severity diagnostics, in original order.
     *
     * @since 0.1
     * @experimental
     * @example
     *     new DiagnosticReport([]).warnings(); // []
     */
    public warnings(): readonly Diagnostic[] {
        return this.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
    }

    /**
     * The `info`-severity diagnostics, in original order.
     *
     * @since 0.1
     * @experimental
     * @example
     *     new DiagnosticReport([]).infos(); // []
     */
    public infos(): readonly Diagnostic[] {
        return this.diagnostics.filter((diagnostic) => diagnostic.severity === "info");
    }

    /**
     * Every diagnostic in original order, regardless of severity.
     *
     * @since 0.1
     * @experimental
     * @example
     *     new DiagnosticReport([]).all(); // []
     */
    public all(): readonly Diagnostic[] {
        return [...this.diagnostics];
    }

    /**
     * A frozen snapshot suitable for handing straight to
     * `ConvertResult.diagnostics`. The returned array is `Object.freeze`d so
     * downstream consumers cannot mutate it.
     *
     * @since 0.1
     * @experimental
     * @example
     *     Object.isFrozen(new DiagnosticReport([]).frozen()); // true
     */
    public frozen(): readonly Diagnostic[] {
        return Object.freeze([...this.diagnostics]);
    }

    /**
     * A new report in which every `warning` has been upgraded to `error` —
     * the strict-mode view. The current report is left unchanged.
     *
     * @since 0.1
     * @experimental
     * @example
     *     const strict = new DiagnosticReport([
     *         {
     *             code: "pine-converter/transform/cap-mismatch",
     *             severity: "warning",
     *             message: "m",
     *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
     *         },
     *     ]).upgradeWarningsToErrors();
     *     strict.errors().length; // 1
     */
    public upgradeWarningsToErrors(): DiagnosticReport {
        return new DiagnosticReport(upgradeWarningsToErrors(this.diagnostics));
    }
}
