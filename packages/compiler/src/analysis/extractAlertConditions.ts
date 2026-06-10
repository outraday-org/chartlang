// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertConditionDefinition } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics";
import { resolveCalleeName } from "../transformers/resolveCallee";

/**
 * Result of extracting `defineAlertCondition({ conditions })` metadata.
 *
 * @since 0.5
 * @stable
 * @example
 *     const r: ExtractAlertConditionsResult = {
 *         alertConditions: [],
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type ExtractAlertConditionsResult = Readonly<{
    alertConditions: ReadonlyArray<AlertConditionDefinition>;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

type ExtractContext = Readonly<{
    sourceFile: ts.SourceFile;
    sourcePath: string;
    diagnostics: CompileDiagnostic[];
}>;

function readPropertyName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }
    return null;
}

function findConditionsInitializer(argument: ts.ObjectLiteralExpression): ts.Expression | null {
    for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!ts.isIdentifier(property.name) || property.name.text !== "conditions") continue;
        return property.initializer;
    }
    return null;
}

function addNotLiteralDiagnostic(node: ts.Node, context: ExtractContext): void {
    context.diagnostics.push(
        createDiagnostic({
            severity: "error",
            code: "alert-condition-not-literal",
            message: "defineAlertCondition conditions must be an object literal.",
            file: context.sourcePath,
            node,
            sourceFile: context.sourceFile,
        }),
    );
}

function addFieldDiagnostic(node: ts.Node, field: string, context: ExtractContext): void {
    context.diagnostics.push(
        createDiagnostic({
            severity: "error",
            code: "alert-condition-field-not-literal",
            message: `defineAlertCondition condition field "${field}" must be a string literal.`,
            file: context.sourcePath,
            node,
            sourceFile: context.sourceFile,
        }),
    );
}

function readStringField(
    object: ts.ObjectLiteralExpression,
    field: "title" | "description" | "defaultMessage",
    context: ExtractContext,
): string | null {
    for (const property of object.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (!ts.isIdentifier(property.name) || property.name.text !== field) continue;
        if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
        addFieldDiagnostic(property.initializer, field, context);
        return null;
    }
    addFieldDiagnostic(object, field, context);
    return null;
}

function readCondition(
    id: string,
    initializer: ts.Expression,
    context: ExtractContext,
): AlertConditionDefinition | null {
    if (!ts.isObjectLiteralExpression(initializer)) {
        addFieldDiagnostic(initializer, id, context);
        return null;
    }
    const title = readStringField(initializer, "title", context);
    const description = readStringField(initializer, "description", context);
    const defaultMessage = readStringField(initializer, "defaultMessage", context);
    if (title === null || description === null || defaultMessage === null) return null;
    return Object.freeze({ id, title, description, defaultMessage });
}

/**
 * Extract literal `defineAlertCondition({ conditions: { ... } })`
 * descriptors into manifest-ready metadata. Dynamic condition maps or
 * dynamic descriptor fields produce error diagnostics and are omitted.
 *
 * @since 0.5
 * @stable
 * @example
 *     // const r = extractAlertConditions(sourceFile, checker, "demo.chart.ts");
 *     const fn: typeof extractAlertConditions = extractAlertConditions;
 *     void fn;
 */
export function extractAlertConditions(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string = sourceFile.fileName,
): ExtractAlertConditionsResult {
    const alertConditions: AlertConditionDefinition[] = [];
    const diagnostics: CompileDiagnostic[] = [];
    const context: ExtractContext = { sourceFile, sourcePath, diagnostics };

    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            resolveCalleeName(node, checker) === "defineAlertCondition"
        ) {
            const argument = node.arguments[0];
            if (argument === undefined || !ts.isObjectLiteralExpression(argument)) {
                addNotLiteralDiagnostic(node, context);
                return;
            }
            const initializer = findConditionsInitializer(argument);
            if (initializer === null || !ts.isObjectLiteralExpression(initializer)) {
                addNotLiteralDiagnostic(initializer ?? argument, context);
                return;
            }
            for (const property of initializer.properties) {
                if (!ts.isPropertyAssignment(property)) continue;
                const id = readPropertyName(property.name);
                if (id === null) {
                    addNotLiteralDiagnostic(property.name, context);
                    continue;
                }
                const condition = readCondition(id, property.initializer, context);
                if (condition !== null) alertConditions.push(condition);
            }
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);

    return Object.freeze({
        alertConditions: Object.freeze(alertConditions.slice()),
        diagnostics: Object.freeze(diagnostics.slice()),
    });
}
