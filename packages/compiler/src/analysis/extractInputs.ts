// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics";
import { resolveCalleeName } from "../transformers/resolveCallee";

const DEFINE_CALLS = new Set(["defineIndicator", "defineAlert", "defineDrawing"]);

/** Names the walker recognises as `input.*` calls. */
const INPUT_KINDS = new Set([
    "int",
    "float",
    "bool",
    "string",
    "enum",
    "color",
    "source",
    "time",
    "price",
    "symbol",
    "interval",
    "externalSeries",
]);

/** Wire-tag mapping — camelCase builder names become kebab-case manifest tags. */
const KIND_TO_WIRE: Readonly<Record<string, string>> = Object.freeze({
    int: "int",
    float: "float",
    bool: "bool",
    string: "string",
    enum: "enum",
    color: "color",
    source: "source",
    time: "time",
    price: "price",
    symbol: "symbol",
    interval: "interval",
    externalSeries: "external-series",
});

/**
 * Frozen, JSON-clean input descriptor extracted from a script's
 * `define*({ inputs })` object.
 *
 * @since 0.4
 * @example
 *     const d: ExtractedDescriptor = { kind: "int", defaultValue: 14 };
 *     void d;
 */
export type ExtractedDescriptor = Readonly<Record<string, unknown>>;

/**
 * Result of input extraction. Diagnostics are hard errors when the
 * declaration uses an unknown builder or non-literal descriptor values.
 *
 * @since 0.4
 * @example
 *     const r: ExtractInputsResult = {
 *         inputs: { length: { kind: "int", defaultValue: 14 } },
 *         userPickableInterval: false,
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type ExtractInputsResult = Readonly<{
    inputs: Readonly<Record<string, ExtractedDescriptor>>;
    userPickableInterval: boolean;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

/**
 * Walk a script's AST and serialise every `input.*` call inside
 * `defineIndicator({ inputs: { ... } })`, `defineAlert`, or
 * `defineDrawing` into the manifest's `inputs` record.
 *
 * @since 0.4
 * @example
 *     // const r = extractInputs(sourceFile, checker, "demo.chart.ts");
 *     // r.inputs.length === { kind: "int", defaultValue: 14 };
 *     const fn: typeof extractInputs = extractInputs;
 *     void fn;
 */
export function extractInputs(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string = sourceFile.fileName,
): ExtractInputsResult {
    const inputs: Record<string, ExtractedDescriptor> = {};
    const diagnostics: CompileDiagnostic[] = [];
    let userPickableInterval = false;
    let intervalCount = 0;

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && isDefineCall(node, checker)) {
            const inputsObject = readInputsArg(node);
            if (inputsObject !== null) {
                for (const property of inputsObject.properties) {
                    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
                        continue;
                    }
                    const initializer = property.initializer;
                    if (!ts.isCallExpression(initializer)) continue;
                    const callee = resolveCalleeName(initializer, checker);
                    if (callee === null || !callee.startsWith("input.")) continue;

                    const kind = callee.slice("input.".length);
                    if (!INPUT_KINDS.has(kind)) {
                        diagnostics.push(
                            createDiagnostic({
                                severity: "error",
                                code: "unknown-input-kind",
                                message: `input.${kind} is not a recognised input builder`,
                                file: sourcePath,
                                node: initializer.expression,
                                sourceFile,
                            }),
                        );
                        continue;
                    }

                    const wireKind = KIND_TO_WIRE[kind] as string;
                    if (wireKind === "interval") {
                        intervalCount += 1;
                        userPickableInterval = true;
                        if (intervalCount > 1) {
                            diagnostics.push(
                                createDiagnostic({
                                    severity: "error",
                                    code: "multiple-input-interval",
                                    message: "Only one input.interval() per script (PLAN §4.5)",
                                    file: sourcePath,
                                    node: initializer.expression,
                                    sourceFile,
                                }),
                            );
                        }
                    }

                    const descriptor = serialiseDescriptor(wireKind, kind, initializer, {
                        sourceFile,
                        sourcePath,
                        diagnostics,
                    });
                    if (descriptor !== null) {
                        inputs[property.name.text] = descriptor;
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    return Object.freeze({
        inputs: Object.freeze({ ...inputs }),
        userPickableInterval,
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

type SerialiseContext = Readonly<{
    sourceFile: ts.SourceFile;
    sourcePath: string;
    diagnostics: CompileDiagnostic[];
}>;

function isDefineCall(node: ts.CallExpression, checker: ts.TypeChecker): boolean {
    const calleeName = resolveCalleeName(node, checker);
    return calleeName !== null && DEFINE_CALLS.has(calleeName);
}

function readInputsArg(node: ts.CallExpression): ts.ObjectLiteralExpression | null {
    const argument = node.arguments[0];
    if (argument === undefined || !ts.isObjectLiteralExpression(argument)) return null;
    for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!ts.isIdentifier(property.name) || property.name.text !== "inputs") continue;
        const initializer = property.initializer;
        if (ts.isObjectLiteralExpression(initializer)) return initializer;
    }
    return null;
}

function serialiseDescriptor(
    wireKind: string,
    builderKind: string,
    call: ts.CallExpression,
    context: SerialiseContext,
): ExtractedDescriptor | null {
    if (wireKind === "external-series") {
        return serialiseExternalSeries(call, context);
    }

    const defaultArg = call.arguments[0];
    if (defaultArg === undefined) {
        addDefaultLiteralDiagnostic(builderKind, call.expression, context);
        return null;
    }
    const defaultValue = readLiteral(defaultArg);
    if (defaultValue === undefined || Array.isArray(defaultValue)) {
        addDefaultLiteralDiagnostic(builderKind, defaultArg, context);
        return null;
    }

    const descriptor: Record<string, unknown> = {
        kind: wireKind,
        defaultValue,
    };

    if (wireKind === "enum") {
        const optionsArg = call.arguments[1];
        const options = optionsArg === undefined ? null : readStringArray(optionsArg);
        if (options === null) {
            addDefaultLiteralDiagnostic(builderKind, optionsArg ?? call.expression, context);
            return null;
        }
        descriptor.options = Object.freeze(options.slice());
        copyObjectLiteralFields(call.arguments[2], descriptor, builderKind, context);
    } else {
        copyObjectLiteralFields(call.arguments[1], descriptor, builderKind, context);
    }

    return Object.freeze(descriptor);
}

function serialiseExternalSeries(
    call: ts.CallExpression,
    context: SerialiseContext,
): ExtractedDescriptor | null {
    const arg = call.arguments[0];
    if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
        addDefaultLiteralDiagnostic("externalSeries", arg ?? call.expression, context);
        return null;
    }

    const descriptor: Record<string, unknown> = { kind: "external-series" };
    let sawName = false;
    let sawSchema = false;

    for (const property of arg.properties) {
        if (ts.isShorthandPropertyAssignment(property) && property.name.text === "schema") {
            descriptor.schema = Object.freeze({ kind: "external-series-schema" });
            sawSchema = true;
            continue;
        }
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyNameText(property.name);
        if (key === null) continue;
        if (key === "name") {
            const value = readLiteral(property.initializer);
            if (typeof value !== "string") {
                addDefaultLiteralDiagnostic("externalSeries", property.initializer, context);
                return null;
            }
            descriptor.name = value;
            sawName = true;
        } else if (key === "schema") {
            descriptor.schema = Object.freeze({ kind: "external-series-schema" });
            sawSchema = true;
        } else if (key === "title") {
            const value = readLiteral(property.initializer);
            if (typeof value !== "string") {
                addDefaultLiteralDiagnostic("externalSeries", property.initializer, context);
                return null;
            }
            descriptor.title = value;
        }
    }

    if (!sawName || !sawSchema) {
        addDefaultLiteralDiagnostic("externalSeries", arg, context);
        return null;
    }
    return Object.freeze(descriptor);
}

function copyObjectLiteralFields(
    arg: ts.Expression | undefined,
    descriptor: Record<string, unknown>,
    builderKind: string,
    context: SerialiseContext,
): void {
    if (arg === undefined) return;
    const unwrapped = unwrapConstAssertion(arg);
    if (!ts.isObjectLiteralExpression(unwrapped)) {
        addDefaultLiteralDiagnostic(builderKind, arg, context);
        return;
    }

    for (const property of unwrapped.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyNameText(property.name);
        if (key === null) continue;
        const value = readLiteral(property.initializer);
        if (value === undefined) {
            addDefaultLiteralDiagnostic(builderKind, property.initializer, context);
            continue;
        }
        descriptor[key] = value;
    }
}

function readLiteral(node: ts.Expression): unknown | undefined {
    const unwrapped = unwrapConstAssertion(node);
    if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text);
    if (
        ts.isPrefixUnaryExpression(unwrapped) &&
        (unwrapped.operator === ts.SyntaxKind.MinusToken ||
            unwrapped.operator === ts.SyntaxKind.PlusToken) &&
        ts.isNumericLiteral(unwrapped.operand)
    ) {
        const value = Number(unwrapped.operand.text);
        return unwrapped.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
        return unwrapped.text;
    }
    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(unwrapped)) {
        const values: string[] = [];
        for (const element of unwrapped.elements) {
            const literal = readLiteral(element);
            if (typeof literal !== "string") return undefined;
            values.push(literal);
        }
        return Object.freeze(values);
    }
    return undefined;
}

function readStringArray(node: ts.Expression): ReadonlyArray<string> | null {
    const value = readLiteral(node);
    if (!Array.isArray(value)) return null;
    return Object.freeze(value.slice());
}

function unwrapConstAssertion(node: ts.Expression): ts.Expression {
    let current = node;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)) {
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression;
        } else {
            current = current.expression;
        }
    }
    return current;
}

function propertyNameText(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }
    return null;
}

function addDefaultLiteralDiagnostic(kind: string, node: ts.Node, context: SerialiseContext): void {
    context.diagnostics.push(
        createDiagnostic({
            severity: "error",
            code: "input-default-not-literal",
            message: `input.${kind} default must be a literal (number / string / boolean), not a variable reference`,
            file: context.sourcePath,
            node,
            sourceFile: context.sourceFile,
        }),
    );
}
