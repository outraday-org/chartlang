// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Return `true` when an offset lands at a **key** position inside the
 * object-literal argument of a `<binding>.withInputs({ ... })` call.
 * Value-position offsets return `false` so completions don't fire when
 * the user is filling in an override's value.
 *
 * @since 0.7
 * @stable
 * @example
 *     const source = 'baseTrend.withInputs({ length: 20 })';
 *     const atKey = isInsideWithInputsKey(source, source.indexOf("length"));
 *     void atKey;
 */
export function isInsideWithInputsKey(source: string, offset: number): boolean {
    const sourceFile = ts.createSourceFile("script.chart.ts", source, ts.ScriptTarget.Latest, true);
    const objectLiteral = findEnclosingWithInputsObjectLiteral(sourceFile, offset);
    if (objectLiteral === null) return false;
    return !isInsideAnyPropertyValueRange(objectLiteral, sourceFile, offset);
}

function findEnclosingWithInputsObjectLiteral(
    sourceFile: ts.SourceFile,
    offset: number,
): ts.ObjectLiteralExpression | null {
    let match: ts.ObjectLiteralExpression | null = null;

    const visit = (node: ts.Node): void => {
        if (match !== null) return;
        if (
            ts.isObjectLiteralExpression(node) &&
            offset > node.getStart(sourceFile) &&
            offset < node.getEnd() &&
            isWithInputsArgument(node)
        ) {
            match = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return match;
}

function isWithInputsArgument(node: ts.ObjectLiteralExpression): boolean {
    const parent = node.parent;
    if (!ts.isCallExpression(parent)) return false;
    if (parent.arguments[0] !== node) return false;
    const callee = parent.expression;
    if (!ts.isPropertyAccessExpression(callee)) return false;
    return callee.name.text === "withInputs";
}

function isInsideAnyPropertyValueRange(
    objectLiteral: ts.ObjectLiteralExpression,
    sourceFile: ts.SourceFile,
    offset: number,
): boolean {
    for (const property of objectLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const initializer = property.initializer;
        const start = initializer.getStart(sourceFile);
        const end = initializer.getEnd();
        if (offset >= start && offset <= end) return true;
    }
    return false;
}
