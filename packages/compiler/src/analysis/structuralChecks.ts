// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";

const DEFINE_CALLS = new Set([
    "defineIndicator",
    "defineAlert",
    "defineDrawing",
    "defineAlertCondition",
]);

type ValueFormat = "price" | "volume" | "percent" | "compact";
type ScaleAxis = "price" | "left" | "right" | "new";

/**
 * Static script-author overrides extracted from the `define*` object
 * literal. Non-literal values are ignored here; later Phase 4 passes attach
 * dedicated diagnostics for stricter validation.
 *
 * @since 0.4
 * @example
 *     const o: StructuralScriptOverrides = { shortName: "EMA", format: "price" };
 *     void o;
 */
export type StructuralScriptOverrides = Readonly<{
    maxBarsBack?: number;
    format?: ValueFormat;
    precision?: number;
    scale?: ScaleAxis;
    requiresIntervals?: ReadonlyArray<string>;
    shortName?: string;
}>;

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
    kind: "indicator" | "drawing" | "alert" | "alertCondition";
    overrides: StructuralScriptOverrides;
}>;

function readStringArray(node: ts.Expression): ReadonlyArray<string> | undefined {
    if (!ts.isArrayLiteralExpression(node)) return undefined;
    const values: string[] = [];
    for (const element of node.elements) {
        if (!ts.isStringLiteral(element)) return undefined;
        values.push(element.text);
    }
    return Object.freeze(values);
}

function readValueFormat(node: ts.Expression): ValueFormat | undefined {
    if (!ts.isStringLiteral(node)) return undefined;
    if (
        node.text === "price" ||
        node.text === "volume" ||
        node.text === "percent" ||
        node.text === "compact"
    ) {
        return node.text;
    }
    return undefined;
}

function readScaleAxis(node: ts.Expression): ScaleAxis | undefined {
    if (!ts.isStringLiteral(node)) return undefined;
    if (
        node.text === "price" ||
        node.text === "left" ||
        node.text === "right" ||
        node.text === "new"
    ) {
        return node.text;
    }
    return undefined;
}

function extractOverrides(
    argument: ts.ObjectLiteralExpression,
    kind: "indicator" | "drawing" | "alert" | "alertCondition",
): StructuralScriptOverrides {
    let maxBarsBack: number | undefined;
    let format: ValueFormat | undefined;
    let precision: number | undefined;
    let scale: ScaleAxis | undefined;
    let requiresIntervals: ReadonlyArray<string> | undefined;
    let shortName: string | undefined;

    for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const propertyName = property.name;
        if (!ts.isIdentifier(propertyName)) continue;
        const initializer = property.initializer;
        if (propertyName.text === "maxBarsBack" && kind !== "drawing") {
            if (ts.isNumericLiteral(initializer)) maxBarsBack = Number(initializer.text);
        } else if (propertyName.text === "format" && kind !== "alert") {
            format = readValueFormat(initializer);
        } else if (propertyName.text === "precision" && kind !== "alert") {
            if (ts.isNumericLiteral(initializer)) precision = Number(initializer.text);
        } else if (propertyName.text === "scale" && kind === "indicator") {
            scale = readScaleAxis(initializer);
        } else if (propertyName.text === "requiresIntervals") {
            requiresIntervals = readStringArray(initializer);
        } else if (propertyName.text === "shortName") {
            if (ts.isStringLiteral(initializer)) shortName = initializer.text;
        }
    }

    return Object.freeze({
        ...(maxBarsBack === undefined ? {} : { maxBarsBack }),
        ...(format === undefined ? {} : { format }),
        ...(precision === undefined ? {} : { precision }),
        ...(scale === undefined ? {} : { scale }),
        ...(requiresIntervals === undefined ? {} : { requiresIntervals }),
        ...(shortName === undefined ? {} : { shortName }),
    });
}

/**
 * Walk the source file's top-level statements to verify:
 *
 * - A default export exists and is `defineIndicator(...)`,
 *   `defineDrawing(...)`, `defineAlert(...)`, or
 *   `defineAlertCondition(...)` from
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
    let kind: "indicator" | "drawing" | "alert" | "alertCondition" = "indicator";

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
                    "Script must default-export a defineIndicator(...), defineDrawing(...), defineAlert(...), or defineAlertCondition(...) call.",
                file: sourcePath,
                node: sourceFile,
                sourceFile,
            }),
        );
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            name,
            kind,
            overrides: Object.freeze({}),
        });
    }

    const expression = exportAssignment.expression;
    if (!ts.isCallExpression(expression)) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "missing-default-export",
                message:
                    "Default export must be a defineIndicator/defineDrawing/defineAlert/defineAlertCondition call.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            name,
            kind,
            overrides: Object.freeze({}),
        });
    }

    const calleeName = resolveCalleeName(expression, checker);
    if (calleeName === null || !DEFINE_CALLS.has(calleeName)) {
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "missing-default-export",
                message:
                    "Default export must call defineIndicator, defineDrawing, defineAlert, or defineAlertCondition from core.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            name,
            kind,
            overrides: Object.freeze({}),
        });
    }
    if (calleeName === "defineAlert") {
        kind = "alert";
    } else if (calleeName === "defineAlertCondition") {
        kind = "alertCondition";
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
                    "defineIndicator/defineDrawing/defineAlert/defineAlertCondition requires an object-literal argument.",
                file: sourcePath,
                node: expression,
                sourceFile,
            }),
        );
        return Object.freeze({
            diagnostics: Object.freeze(diagnostics),
            name,
            kind,
            overrides: Object.freeze({}),
        });
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
                const found = initializer.getText(sourceFile);
                diagnostics.push(
                    createDiagnostic({
                        severity: "error",
                        code: "api-version-mismatch",
                        message: `\`apiVersion: ${found}\` is not supported — this compiler implements the frozen \`apiVersion: 1\` contract. Future language versions require a compiler that declares support for them.`,
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
                message:
                    "defineIndicator/defineDrawing/defineAlert/defineAlertCondition requires `apiVersion: 1` — the frozen language version this compiler implements.",
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
        overrides: extractOverrides(argument, kind),
    });
}
