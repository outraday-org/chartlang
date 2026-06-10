// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Return true when an offset sits inside a completable interval string.
 *
 * @since 0.4
 * @stable
 * @example
 *     const inside = isInsideIntervalLiteral('request.security({ interval: "" })', 31);
 *     void inside;
 */
export function isInsideIntervalLiteral(source: string, offset: number): boolean {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    let matched = false;

    const visit = (node: ts.Node): void => {
        if (matched) return;
        if (
            ts.isStringLiteral(node) &&
            offset > node.getStart(sourceFile) &&
            offset < node.getEnd()
        ) {
            matched = isIntervalLiteralNode(node, sourceFile);
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return matched;
}

function isIntervalLiteralNode(node: ts.StringLiteral, sourceFile: ts.SourceFile): boolean {
    const parent = node.parent;
    if (ts.isCallExpression(parent)) return callName(parent, sourceFile) === "input.interval";
    if (!ts.isPropertyAssignment(parent)) return false;
    if (!propertyNameIs(parent.name, "interval")) return false;

    const objectLiteral = parent.parent;
    /* v8 ignore next -- PropertyAssignment nodes are owned by ObjectLiteralExpression. */
    if (!ts.isObjectLiteralExpression(objectLiteral)) return false;
    const call = objectLiteral.parent;
    return ts.isCallExpression(call) && callName(call, sourceFile) === "request.security";
}

function propertyNameIs(name: ts.PropertyName, expected: string): boolean {
    return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === expected;
}

function callName(call: ts.CallExpression, sourceFile: ts.SourceFile): string | null {
    const expression = call.expression;
    if (!ts.isPropertyAccessExpression(expression)) return null;
    const left = expression.expression;
    /* v8 ignore next -- covered defensively for malformed/incremental ASTs. */
    if (!ts.isIdentifier(left)) return null;
    return `${left.text}.${expression.name.getText(sourceFile)}`;
}
