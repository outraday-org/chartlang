// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SecurityExpressionDescriptor } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { callsiteIdFor } from "../transformers/callsiteIdInjection.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";
import type { ExtractedDescriptor } from "./extractInputs.js";
import { validateSecurityExpr } from "./validateSecurityExpr.js";

/**
 * Combined result of the `request.*` analysis pass: the sorted, deduped list
 * of requested intervals plus one {@link SecurityExpressionDescriptor} per
 * `request.security({ interval }, (bar) => …)` expression callsite (sorted by
 * `slotId`).
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RequestAnalysis = { intervals: ["1W"], securityExpressions: [] };
 *     void r;
 */
export type RequestAnalysis = Readonly<{
    intervals: ReadonlyArray<string>;
    securityExpressions: ReadonlyArray<SecurityExpressionDescriptor>;
}>;

/**
 * Walk a script's AST and collect every static `interval` argument to
 * `request.security({ interval: ... })` and `request.lowerTf(...)`, plus every
 * `request.security` *expression* callsite (a second arrow/function argument).
 * Dynamic intervals emit `request-security-interval-not-literal` (for
 * `request.security`) or `request-lower-tf-interval-not-literal` (for
 * `request.lowerTf`) and are excluded.
 *
 * Each expression callsite is recorded as a {@link SecurityExpressionDescriptor}
 * keyed by the same `slotId` the callsite-id transformer injects (via the
 * shared `callsiteIdFor` helper) so the runtime can match the manifest entry
 * to the inlined callback. When `validateExpressions` is `true`, each callback
 * is also run through {@link validateSecurityExpr}, pushing
 * `request-security-expr-captures-local` for any out-of-subset reference.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const { intervals, securityExpressions } =
 *     //     extractRequestAnalysis(sf, checker, inputs, diagnostics, path, true);
 *     const fn: typeof extractRequestAnalysis = extractRequestAnalysis;
 *     void fn;
 */
export function extractRequestAnalysis(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
    diagnostics: CompileDiagnostic[],
    sourcePath: string = sourceFile.fileName,
    validateExpressions = false,
): RequestAnalysis {
    const intervals = new Set<string>();
    const securityExpressions: SecurityExpressionDescriptor[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName === "request.security" || calleeName === "request.lowerTf") {
                readRequestInterval(
                    node,
                    calleeName,
                    sourceFile,
                    sourcePath,
                    inputs,
                    diagnostics,
                    intervals,
                );
            }
            if (calleeName === "request.security") {
                readSecurityExpression(
                    node,
                    sourceFile,
                    sourcePath,
                    checker,
                    diagnostics,
                    validateExpressions,
                    securityExpressions,
                );
            }
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    securityExpressions.sort((a, b) => a.slotId.localeCompare(b.slotId));
    return Object.freeze({
        intervals: Object.freeze(Array.from(intervals).sort()),
        securityExpressions: Object.freeze(securityExpressions.slice()),
    });
}

/**
 * Walk a script's AST and collect every static `interval` argument to
 * `request.security({ interval: ... })` and `request.lowerTf(...)`. Dynamic
 * arguments emit `request-security-interval-not-literal` (for `request.security`)
 * or `request-lower-tf-interval-not-literal` (for `request.lowerTf`) and are
 * excluded. Thin delegate over {@link extractRequestAnalysis} kept for callers
 * that only need the interval list.
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
    return extractRequestAnalysis(sourceFile, checker, inputs, diagnostics, sourcePath).intervals;
}

/**
 * Detect and record a `request.security` expression callsite — a second
 * argument that is an arrow or function expression. Mints the descriptor's
 * `slotId` via `callsiteIdFor` (lockstep with the injector), reads the literal
 * `interval` and the callback's single parameter name, and — when
 * `validate` — runs the capture check. A callsite whose interval is not a
 * compile-time literal already emitted `request-security-interval-not-literal`
 * via `readRequestInterval`; it is skipped here (no descriptor).
 */
function readSecurityExpression(
    call: ts.CallExpression,
    sourceFile: ts.SourceFile,
    sourcePath: string,
    checker: ts.TypeChecker,
    diagnostics: CompileDiagnostic[],
    validate: boolean,
    out: SecurityExpressionDescriptor[],
): void {
    const callback = call.arguments[1];
    if (
        callback === undefined ||
        !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
    ) {
        return;
    }
    if (validate) {
        validateSecurityExpr(callback, checker, diagnostics, sourcePath);
    }
    const interval = readLiteralInterval(call);
    if (interval === null) return;
    const firstParam = callback.parameters[0];
    const paramName =
        firstParam !== undefined && ts.isIdentifier(firstParam.name) ? firstParam.name.text : "";
    out.push(
        Object.freeze({
            slotId: callsiteIdFor(sourceFile, call, sourcePath),
            interval,
            paramName,
        }),
    );
}

/**
 * Read the literal `interval` string off a `request.security` call's opts
 * object, or `null` when it is absent or non-literal. Only string-literal
 * intervals key an expression unit; an `input.enum` interval expands to
 * multiple intervals for the requested-interval list but cannot anchor a
 * single expression clock, so it is treated as non-literal here.
 */
function readLiteralInterval(call: ts.CallExpression): string | null {
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return null;
    const intervalProperty = opts.properties
        .filter(ts.isPropertyAssignment)
        .find((property) => ts.isIdentifier(property.name) && property.name.text === "interval");
    if (intervalProperty === undefined) return null;
    const initializer = intervalProperty.initializer;
    return ts.isStringLiteral(initializer) ? initializer.text : null;
}

function readRequestInterval(
    call: ts.CallExpression,
    calleeName: "request.security" | "request.lowerTf",
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
            code:
                calleeName === "request.lowerTf"
                    ? "request-lower-tf-interval-not-literal"
                    : "request-security-interval-not-literal",
            message: `${calleeName}({ interval }) must be a string literal or input.enum value`,
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
