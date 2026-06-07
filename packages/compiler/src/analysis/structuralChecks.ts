// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics";
import { resolveCalleeName } from "../transformers/resolveCallee";

const DEFINE_CALLS = new Set(["defineIndicator", "defineAlert", "defineDrawing"]);

/**
 * Result of `runStructuralChecks` — the discovered script `name` / `kind`
 * for the manifest, plus any structural diagnostics. `name` is `""` when no
 * default export is present; `kind` defaults to `"indicator"` for the same
 * reason. The driver only consumes these fields when there are zero
 * error-severity diagnostics.
 *
 * The `"drawing"` kind (Phase 3 / `defineDrawing` / PLAN.md §4.1) maps to
 * the same code path the other two kinds use — only the manifest's
 * discriminator differs so the editor can route the script to the
 * drawing-tool picker vs the indicator-picker UI.
 *
 * @since 0.1
 * @example
 *     const r: StructuralCheckResult = {
 *         diagnostics: [],
 *         name: "demo",
 *         kind: "indicator",
 *     };
 *     void r;
 */
export type StructuralCheckResult = Readonly<{
    diagnostics: ReadonlyArray<CompileDiagnostic>;
    name: string;
    kind: "indicator" | "drawing" | "alert";
}>;

/**
 * Walk the source file's top-level statements to verify:
 *
 * - A default export exists and is `defineIndicator(...)`,
 *   `defineDrawing(...)`, or `defineAlert(...)` from
 *   `@invinite-org/chartlang-core`.
 * - The first argument is an object literal carrying `apiVersion: 1`.
 *
 * On any violation, emits `missing-default-export` or
 * `api-version-mismatch`. Returns the discovered script name + kind for
 * the manifest assembly step.
 *
 * @since 0.1
 * @example
 *     // const { diagnostics, name, kind } = runStructuralChecks(
 *     //     sourceFile, checker, "demo.chart.ts",
 *     // );
 *     const fn: typeof runStructuralChecks = runStructuralChecks;
 *     void fn;
 */
export function runStructuralChecks(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
): StructuralCheckResult {
    const diagnostics: CompileDiagnostic[] = [];
    let name = "";
    let kind: "indicator" | "drawing" | "alert" = "indicator";

    const exportAssignment = sourceFile.statements.find(
        (statement): statement is ts.ExportAssignment =>
            ts.isExportAssignment(statement) && !statement.isExportEquals,
    );
    if (!exportAssignment) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "missing-default-export",
                message:
                    "Script must default-export a defineIndicator(...), defineDrawing(...), or defineAlert(...) call.",
                file: sourcePath,
                node: sourceFile,
                sourceFile,
            }),
        );
        return Object.freeze({ diagnostics: Object.freeze(diagnostics), name, kind });
    }

    const expression = exportAssignment.expression;
    if (!ts.isCallExpression(expression)) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "missing-default-export",
                message: "Default export must be a defineIndicator/defineDrawing/defineAlert call.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({ diagnostics: Object.freeze(diagnostics), name, kind });
    }

    const calleeName = resolveCalleeName(expression, checker);
    if (calleeName === null || !DEFINE_CALLS.has(calleeName)) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "missing-default-export",
                message:
                    "Default export must call defineIndicator, defineDrawing, or defineAlert from core.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({ diagnostics: Object.freeze(diagnostics), name, kind });
    }
    if (calleeName === "defineAlert") {
        kind = "alert";
    } else if (calleeName === "defineDrawing") {
        kind = "drawing";
    } else {
        kind = "indicator";
    }

    const argument = expression.arguments[0];
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "api-version-mismatch",
                message:
                    "defineIndicator/defineDrawing/defineAlert requires an object-literal argument.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({ diagnostics: Object.freeze(diagnostics), name, kind });
    }

    let apiVersionOk = false;
    for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const propertyName = property.name;
        if (!ts.isIdentifier(propertyName)) continue;
        if (propertyName.text === "apiVersion") {
            const initializer = property.initializer;
            if (ts.isNumericLiteral(initializer) && Number(initializer.text) === 1) {
                apiVersionOk = true;
            } else {
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "api-version-mismatch",
                        message: "Only apiVersion: 1 is supported in Phase 1.",
                        file: sourcePath,
                        node: initializer,
                        sourceFile,
                    }),
                );
            }
        } else if (propertyName.text === "name") {
            const initializer = property.initializer;
            if (ts.isStringLiteral(initializer)) {
                name = initializer.text;
            }
        }
    }
    if (!apiVersionOk && diagnostics.length === 0) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "api-version-mismatch",
                message: "defineIndicator/defineDrawing/defineAlert requires apiVersion: 1.",
                file: sourcePath,
                node: argument,
                sourceFile,
            }),
        );
    }

    return Object.freeze({
        diagnostics: Object.freeze(diagnostics),
        name,
        kind,
    });
}
