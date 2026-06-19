// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics.js";
import { resolveCalleeName } from "../transformers/resolveCallee.js";

const OHLCV_FIELDS = new Set(["close", "open", "high", "low", "volume", "time"]);

/**
 * Maximum literal lookback `N` discovered across every series read in the
 * source plus the inferred `seriesCapacities` record. `dynamicFallback`
 * captures the §6.6 contract: any non-literal series index contributes
 * `5000` so the runtime can size its ring buffers safely.
 *
 * @since 0.1
 * @example
 *     const r: ExtractMaxLookbackResult = {
 *         maxLookback: 20,
 *         seriesCapacities: {},
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type ExtractMaxLookbackResult = Readonly<{
    maxLookback: number;
    seriesCapacities: Readonly<Record<string, number>>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

/**
 * Walk the source file's `ElementAccessExpression` nodes and infer
 * `maxLookback` plus any `dynamicFallback` capacity from non-literal index
 * reads on Phase-1 series shapes: `bar.<ohlcv>[N]`, `ta.<name>(...)[N]`,
 * and identifier-bound series variables (`const e = ta.ema(...); e[N];`).
 *
 * The optional `scope` parameter narrows both the series-variable
 * collection and the lookback walk to a single AST subtree (typically
 * one binding's `defineCall`) so multi-export files derive per-binding
 * `maxLookback` values. Defaults to the whole `sourceFile`.
 *
 * @since 0.1
 * @example
 *     // const { maxLookback, seriesCapacities, diagnostics } =
 *     //     extractMaxLookback(sourceFile, checker, "demo.chart.ts");
 *     const fn: typeof extractMaxLookback = extractMaxLookback;
 *     void fn;
 */
export function extractMaxLookback(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    scope: ts.Node = sourceFile,
): ExtractMaxLookbackResult {
    let maxLookback = 0;
    const seriesCapacities: Record<string, number> = {};
    const diagnostics: CompileDiagnostic[] = [];

    const seriesVarNames = collectSeriesVarNames(scope, checker);

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const calleeName = resolveCalleeName(node, checker);
            if (calleeName?.startsWith("ta.")) {
                const barsDepth = readHighestLowestBarsDepth(calleeName, node);
                if (barsDepth > maxLookback) maxLookback = barsDepth;
            }
            if (isBarPointCall(node)) {
                const depth = readBarPointLookback(node);
                if (depth > maxLookback) maxLookback = depth;
            }
        }
        if (ts.isElementAccessExpression(node)) {
            if (isSeriesShapedAccess(node, checker, seriesVarNames)) {
                const argument = node.argumentExpression;
                if (ts.isNumericLiteral(argument)) {
                    const n = Number(argument.text);
                    if (n > maxLookback) maxLookback = n;
                } else {
                    diagnostics.push(
                        createDiagnostic({
                            severity: "warning",
                            code: "dynamic-series-index",
                            message:
                                "Non-literal series index — runtime will use the 5000-slot dynamic fallback buffer.",
                            file: sourcePath,
                            node: argument,
                            sourceFile,
                        }),
                    );
                    seriesCapacities.dynamicFallback = 5000;
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(scope);

    return Object.freeze({
        maxLookback,
        seriesCapacities: Object.freeze({ ...seriesCapacities }),
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}

/**
 * Whether a call is a `bar.point(…)` invocation. Matched textually on the
 * `bar.point` property-access shape — the same OHLCV-style textual recognition
 * `isSeriesShapedAccess` uses — so it fires for both the destructured
 * `compute({ bar })` binding and a `declare const bar: Bar` test fixture.
 */
function isBarPointCall(call: ts.CallExpression): boolean {
    const expression = call.expression;
    return (
        ts.isPropertyAccessExpression(expression) &&
        expression.name.text === "point" &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "bar"
    );
}

/**
 * Unwrap any number of nested parentheses around an expression. The Pine
 * converter emits a historical bar offset as the parenthesised form
 * `bar.point(-(N), …)` (see the converter's `anchorToWorldPoint`), so the
 * lookback recogniser must peel the parens before matching the literal.
 */
function unwrapParens(node: ts.Expression): ts.Expression {
    let current = node;
    while (ts.isParenthesizedExpression(current)) current = current.expression;
    return current;
}

/**
 * The historical-lookback depth a `bar.point(offset, …)` call contributes,
 * or `0` when it reads the current / a future bar. A negative integer-literal
 * first argument (`bar.point(-N, …)` — or the converter's parenthesised
 * `bar.point(-(N), …)`) anchors `N` bars back, so the runtime's time ring
 * buffer must retain `N` extra slots — exactly like a `series[N]` lookback.
 * `bar.point(0, …)` (current) and positive offsets (future, extrapolated, no
 * buffer depth) contribute `0`; a non-literal / dynamic offset (e.g. a bound
 * `-k` or a computed `-(2 + 3)`) cannot be sized at compile time and also
 * contributes `0` (reads past retention degrade to a NaN time at runtime, per
 * `bar.point`'s contract).
 */
function readBarPointLookback(call: ts.CallExpression): number {
    const first = call.arguments[0];
    if (first === undefined) return 0;
    const expr = unwrapParens(first);
    if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.MinusToken) {
        const operand = unwrapParens(expr.operand);
        if (ts.isNumericLiteral(operand)) {
            const n = Number(operand.text);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }
    return 0;
}

function collectSeriesVarNames(scope: ts.Node, checker: ts.TypeChecker): ReadonlySet<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            const initializer = node.initializer;
            if (initializer && ts.isCallExpression(initializer)) {
                const calleeName = resolveCalleeName(initializer, checker);
                if (calleeName?.startsWith("ta.")) {
                    names.add(node.name.text);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(scope);
    return names;
}

/**
 * The historical-lookback depth a `ta.highestbars` / `ta.lowestbars` call
 * contributes. Both primitives return the bar OFFSET (≤ 0) to the extreme
 * over the trailing `length`-bar window, so the deepest offset they can
 * return is `-(length − 1)`. A downstream `bar.point(<that offset>, …)`
 * anchor reads `time.at(length − 1)`, so the runtime's time ring buffer
 * must retain `length − 1` slots. Only a LITERAL second positional `length`
 * arg can be sized at compile time; a non-literal length contributes `0`.
 */
function readHighestLowestBarsDepth(calleeName: string, call: ts.CallExpression): number {
    if (calleeName !== "ta.highestbars" && calleeName !== "ta.lowestbars") return 0;
    const lengthArg = call.arguments[1];
    if (lengthArg === undefined || !ts.isNumericLiteral(lengthArg)) return 0;
    const length = Number(lengthArg.text);
    if (!Number.isFinite(length) || length <= 1) return 0;
    return length - 1;
}

function isSeriesShapedAccess(
    node: ts.ElementAccessExpression,
    checker: ts.TypeChecker,
    seriesVarNames: ReadonlySet<string>,
): boolean {
    const expression = node.expression;
    if (ts.isPropertyAccessExpression(expression)) {
        if (OHLCV_FIELDS.has(expression.name.text)) return true;
    }
    if (ts.isCallExpression(expression)) {
        const calleeName = resolveCalleeName(expression, checker);
        if (calleeName?.startsWith("ta.")) return true;
    }
    if (ts.isIdentifier(expression)) {
        if (seriesVarNames.has(expression.text)) return true;
    }
    return false;
}
