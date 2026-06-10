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

/**
 * Walk a script's default define call and collect a static
 * `requiresIntervals: ["..."]` array. Non-string entries emit
 * `requires-intervals-not-literal` and are excluded from the result.
 *
 * @since 0.4
 * @example
 *     // const intervals = extractRequiresIntervals(sf, checker, diagnostics);
 *     // intervals === ["1D", "1W"];
 *     const fn: typeof extractRequiresIntervals = extractRequiresIntervals;
 *     void fn;
 */
export function extractRequiresIntervals(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    diagnostics: CompileDiagnostic[],
    sourcePath: string = sourceFile.fileName,
): ReadonlyArray<string> {
    const intervals = new Set<string>();

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && isDefineCall(node, checker)) {
            readRequiresIntervals(node, sourceFile, sourcePath, diagnostics, intervals);
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return Object.freeze(Array.from(intervals).sort());
}

function isDefineCall(node: ts.CallExpression, checker: ts.TypeChecker): boolean {
    const calleeName = resolveCalleeName(node, checker);
    return calleeName !== null && DEFINE_CALLS.has(calleeName);
}

function readRequiresIntervals(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
    intervals: Set<string>,
): void {
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return;
    const property = opts.properties
        .filter(ts.isPropertyAssignment)
        .find(
            (candidate) =>
                ts.isIdentifier(candidate.name) && candidate.name.text === "requiresIntervals",
        );
    if (property === undefined) return;

    if (!ts.isArrayLiteralExpression(property.initializer)) {
        addDiagnostic(property.initializer, sourceFile, sourcePath, diagnostics);
        return;
    }

    for (const element of property.initializer.elements) {
        if (ts.isStringLiteral(element)) {
            intervals.add(element.text);
        } else {
            addDiagnostic(element, sourceFile, sourcePath, diagnostics);
        }
    }
}

function addDiagnostic(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    diagnostics: CompileDiagnostic[],
): void {
    diagnostics.push(
        createDiagnostic({
            severity: "error",
            code: "requires-intervals-not-literal",
            message: "defineIndicator({ requiresIntervals }) must be a static string-literal array",
            file: sourcePath,
            node,
            sourceFile,
        }),
    );
}
