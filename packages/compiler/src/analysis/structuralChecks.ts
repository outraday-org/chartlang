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
    /**
     * `defineIndicator({ overlay })` literal-boolean extraction. Persisted
     * onto `ScriptManifest.overlay` so the runtime can derive each script's
     * default pane at mount. Only `true` / `false` literals are picked up;
     * any other initializer is silently ignored.
     *
     * @since 0.2
     */
    overlay?: boolean;
    maxBarsBack?: number;
    format?: ValueFormat;
    precision?: number;
    scale?: ScaleAxis;
    requiresIntervals?: ReadonlyArray<string>;
    shortName?: string;
}>;

/**
 * Classified `defineIndicator(...)` / `defineAlert(...)` /
 * `defineDrawing(...)` / `defineAlertCondition(...)` binding discovered
 * by `runStructuralChecks`. Phase 7's indicator-composition pass reads
 * this list to walk the file's full dependency graph.
 *
 * `exportKind: "default"` = the file's `export default define*(...)`
 * binding. There is always at most one in a valid file.
 * `exportKind: "named"` = `export const X = define*(...);` — a drawn
 * sibling that the host will mount alongside the default.
 * `exportKind: "private"` = `const X = define*(...);` (no `export`)
 * — a data-only dependency that only flows into other indicators.
 *
 * `bindingName` is the local identifier; for `default` bindings it is
 * always the synthetic string `"default"` so consumers can index by
 * binding-name uniformly.
 *
 * @since 0.7
 * @stable
 * @example
 *     const info: StructuralBindingInfo = {
 *         exportKind: "default",
 *         bindingName: "default",
 *         defineKind: "indicator",
 *         defineCall: undefined as unknown as ts.CallExpression,
 *     };
 *     void info;
 */
export type StructuralBindingInfo = Readonly<{
    readonly exportKind: "default" | "named" | "private";
    readonly bindingName: string;
    readonly defineKind: "indicator" | "drawing" | "alert" | "alertCondition";
    readonly defineCall: ts.CallExpression;
}>;

/**
 * Result of `runStructuralChecks` — the discovered script `name` / `kind`
 * for the manifest, plus any structural diagnostics. `name` is `""` when no
 * default export is present; `kind` defaults to `"indicator"` for the same
 * reason. The driver only consumes these fields when there are zero
 * error-severity diagnostics.
 *
 * The `"drawing"` kind (Phase 3 / `defineDrawing`) maps to
 * the same code path the other two kinds use — only the manifest's
 * discriminator differs so the editor can route the script to the
 * drawing-tool picker vs the indicator-picker UI.
 *
 * `bindings` (Phase 7) lists every top-level `defineIndicator(...)` /
 * `defineAlert(...)` / `defineDrawing(...)` / `defineAlertCondition(...)`
 * `const` binding the file declares — default + named + private. Empty
 * on files with no recognised default export.
 *
 * @since 0.1
 * @example
 *     const r: StructuralCheckResult = {
 *         diagnostics: [],
 *         name: "demo",
 *         kind: "indicator",
 *         overrides: {},
 *         bindings: [],
 *     };
 *     void r;
 */
export type StructuralCheckResult = Readonly<{
    diagnostics: ReadonlyArray<CompileDiagnostic>;
    name: string;
    kind: "indicator" | "drawing" | "alert" | "alertCondition";
    overrides: StructuralScriptOverrides;
    /** @since 0.7 */
    bindings: ReadonlyArray<StructuralBindingInfo>;
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
    let overlay: boolean | undefined;
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
        if (propertyName.text === "overlay" && kind === "indicator") {
            if (initializer.kind === ts.SyntaxKind.TrueKeyword) overlay = true;
            else if (initializer.kind === ts.SyntaxKind.FalseKeyword) overlay = false;
        } else if (propertyName.text === "maxBarsBack" && kind !== "drawing") {
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
        ...(overlay === undefined ? {} : { overlay }),
        ...(maxBarsBack === undefined ? {} : { maxBarsBack }),
        ...(format === undefined ? {} : { format }),
        ...(precision === undefined ? {} : { precision }),
        ...(scale === undefined ? {} : { scale }),
        ...(requiresIntervals === undefined ? {} : { requiresIntervals }),
        ...(shortName === undefined ? {} : { shortName }),
    });
}

function defineKindFromCallee(
    calleeName: string,
): "indicator" | "drawing" | "alert" | "alertCondition" {
    if (calleeName === "defineAlert") return "alert";
    if (calleeName === "defineAlertCondition") return "alertCondition";
    if (calleeName === "defineDrawing") return "drawing";
    return "indicator";
}

type BindingCollector = Readonly<{
    readonly bindings: StructuralBindingInfo[];
    readonly defaultAssignments: ts.ExportAssignment[];
}>;

function collectBindings(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): BindingCollector {
    const bindings: StructuralBindingInfo[] = [];
    const defaultAssignments: ts.ExportAssignment[] = [];

    for (const statement of sourceFile.statements) {
        if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
            defaultAssignments.push(statement);
            const expression = statement.expression;
            if (!ts.isCallExpression(expression)) continue;
            const calleeName = resolveCalleeName(expression, checker);
            if (calleeName === null || !DEFINE_CALLS.has(calleeName)) continue;
            bindings.push(
                Object.freeze({
                    exportKind: "default",
                    bindingName: "default",
                    defineKind: defineKindFromCallee(calleeName),
                    defineCall: expression,
                }),
            );
            continue;
        }
        if (ts.isVariableStatement(statement)) {
            const isExported = (statement.modifiers ?? []).some(
                (m) => m.kind === ts.SyntaxKind.ExportKeyword,
            );
            const declarationList = statement.declarationList;
            const isConst = (declarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const;
            for (const declaration of declarationList.declarations) {
                /* v8 ignore next */
                if (!ts.isIdentifier(declaration.name)) continue;
                const initializer = declaration.initializer;
                if (initializer === undefined || !ts.isCallExpression(initializer)) continue;
                const calleeName = resolveCalleeName(initializer, checker);
                if (calleeName === null || !DEFINE_CALLS.has(calleeName)) continue;
                if (!isConst) {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "error",
                            code: "non-const-define-binding",
                            message: `\`${calleeName}(...)\` must be assigned to a \`const\` binding so the compiler can statically resolve it.`,
                            file: sourcePath,
                            node: declaration,
                            sourceFile,
                        }),
                    );
                    continue;
                }
                bindings.push(
                    Object.freeze({
                        exportKind: isExported ? "named" : "private",
                        bindingName: declaration.name.text,
                        defineKind: defineKindFromCallee(calleeName),
                        defineCall: initializer,
                    }),
                );
            }
        }
    }

    return Object.freeze({ bindings, defaultAssignments });
}

/**
 * Walk the source file's top-level statements to verify:
 *
 * - Exactly one default export exists and is `defineIndicator(...)`,
 *   `defineDrawing(...)`, `defineAlert(...)`, or
 *   `defineAlertCondition(...)` from `@invinite-org/chartlang-core`.
 * - Every `define*(...)` call sits on a `const` binding (Phase 7
 *   composition pass requires static resolution).
 * - The default export's first argument is an object literal carrying
 *   `apiVersion: 1`.
 *
 * On any violation, emits `missing-default-export`,
 * `multiple-default-exports`, `non-const-define-binding`, or
 * `api-version-mismatch`. Returns the discovered script name + kind
 * for the manifest assembly step plus the classified `bindings` list
 * the composition pass walks (Phase 7).
 *
 * @since 0.1
 * @example
 *     // const { diagnostics, name, kind, bindings } = runStructuralChecks(
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

    const { bindings, defaultAssignments } = collectBindings(
        sourceFile,
        checker,
        sourcePath,
        diagnostics,
    );
    const frozenBindings = Object.freeze(bindings.slice());

    if (defaultAssignments.length > 1) {
        for (let i = 1; i < defaultAssignments.length; i += 1) {
            const extra = defaultAssignments[i];
            /* v8 ignore next */
            if (extra === undefined) continue;
            diagnostics.push(
                createDiagnostic({
                    severity: "error",
                    code: "multiple-default-exports",
                    message:
                        "A `.chart.ts` file may declare at most one `export default define*(...)`; remove the extra default export.",
                    file: sourcePath,
                    node: extra,
                    sourceFile,
                }),
            );
        }
    }

    const exportAssignment = defaultAssignments[0];
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
            bindings: frozenBindings,
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
            bindings: frozenBindings,
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
            bindings: frozenBindings,
        });
    }
    kind = defineKindFromCallee(calleeName);

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
            bindings: frozenBindings,
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
        bindings: frozenBindings,
    });
}
