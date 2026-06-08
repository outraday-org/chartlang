// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics";
import { resolveCalleeName } from "../transformers/resolveCallee";
import type { ExtractedDescriptor } from "./extractInputs";

/**
 * Walk a script's AST and collect every static `interval` argument to
 * `request.security({ interval: ... })`. Dynamic arguments emit
 * `request-security-interval-not-literal` and are excluded.
 *
 * @since 0.4
 * @example
 *     // const intervals = extractRequestedIntervals(sf, checker, inputs, diagnostics);
 *     // intervals === ["1D", "5m"];
 *     const fn: typeof extractRequestedIntervals = extractRequestedIntervals;
 *     void fn;
 */
export function extractRequestedIntervals(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    sourcePath: string = sourceFile.fileName,
): ReadonlyArray<string> {
    const intervals = new Set<string>();

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && resolveCalleeName(node, checker) === "request.security") {
            readRequestInterval(node, sourceFile, sourcePath, inputs, diagnostics, intervals);
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return Object.freeze(Array.from(intervals).sort());
}

function readRequestInterval(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    intervals: Set<string>,
): void {
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return;
    const intervalProperty = opts.properties
        .filter(ts.isPropertyAssignment)
        .find((property) => ts.isIdentifier(property.name) && property.name.text === "interval");
    if (intervalProperty === undefined) return;

    const initializer = intervalProperty.initializer;
    if (ts.isStringLiteral(initializer)) {
        intervals.add(initializer.text);
        return;
    }

    const enumOptions = getInputsEnumOptions(initializer, inputs);
    if (enumOptions !== null) {
        for (const option of enumOptions) intervals.add(option);
        return;
    }

    diagnostics.push(
        createDiagnostic({
            severity: "error",
            code: "request-security-interval-not-literal",
            message: "request.security({ interval }) must be a string literal or input.enum value",
            file: sourcePath,
            node: initializer,
            sourceFile,
        }),
    );
}

function getInputsEnumOptions(
    expr: ts.Expression,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): ReadonlyArray<string> | null {
    if (
        !ts.isPropertyAccessExpression(expr) ||
        !ts.isIdentifier(expr.expression) ||
        expr.expression.text !== "inputs"
    ) {
        return null;
    }
    const descriptor = inputs[expr.name.text];
    if (descriptor === undefined || descriptor.kind !== "enum") return null;
    const options = descriptor.options;
    if (!Array.isArray(options)) return null;
    const strings: string[] = [];
    for (const option of options) {
        if (typeof option !== "string") return null;
        strings.push(option);
    }
    return Object.freeze(strings);
}
