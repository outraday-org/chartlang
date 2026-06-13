// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import type { DefinitionLocation, HoverDoc } from "../types.js";
import { findTokenAtOffset } from "./resolveFqnAtOffset.js";

/**
 * Producer-side input descriptor surfaced by the dep accessor helpers.
 * `kind` is the `input.<kind>(default)` builder name; `defaultText` is
 * the literal default-value text printed verbatim into the completion
 * detail line.
 *
 * @since 0.7
 * @stable
 * @example
 *     const d: DepInputDescriptor = {
 *         name: "length",
 *         kind: "int",
 *         defaultText: "20",
 *     };
 *     void d;
 */
export type DepInputDescriptor = Readonly<{
    name: string;
    kind: string;
    defaultText: string;
}>;

const SCRIPT_FILE_NAME = "script.chart.ts";

/**
 * Resolve a hover doc when the offset lands on a `<binding>.output(...)`
 * or `<binding>.withInputs({...})` call site whose binding's initialiser
 * is a same-file `defineIndicator(...)` (optionally chained through
 * `.withInputs(...)`).
 *
 * @since 0.7
 * @stable
 * @example
 *     const fn: typeof resolveDepAccessorHover = resolveDepAccessorHover;
 *     void fn;
 */
export function resolveDepAccessorHover(source: string, offset: number): HoverDoc | null {
    const accessor = findAccessorAtOffset(source, offset);
    if (accessor === null) return null;
    const sourceFile = parse(source);
    const producer = resolveProducerForBinding(sourceFile, accessor.bindingName);
    if (producer === null) return null;
    if (accessor.kind === "output") return formatOutputHover(accessor.bindingName, producer);
    return formatWithInputsHover(accessor.bindingName, producer);
}

/**
 * Resolve a best-effort go-to-definition target for a
 * `<binding>.output("title")` call. Returns the line / column of the
 * producer's matching `plot(value, { title: "<title>" })` call when
 * resolvable. Returns `null` when the binding is missing, the producer
 * is not a same-file `defineIndicator`, or no matching `plot` call is
 * found.
 *
 * @since 0.7
 * @stable
 * @example
 *     const fn: typeof resolveDepAccessorDefinition = resolveDepAccessorDefinition;
 *     void fn;
 */
export function resolveDepAccessorDefinition(
    source: string,
    offset: number,
): DefinitionLocation | null {
    const accessor = findAccessorAtOffset(source, offset);
    if (accessor === null || accessor.kind !== "output") return null;
    const sourceFile = parse(source);
    const producer = resolveProducerForBinding(sourceFile, accessor.bindingName);
    if (producer === null) return null;

    const title = accessor.outputTitle;
    if (title === null) return null;

    for (const plotCall of producer.plotCalls) {
        if (plotCall.title !== title) continue;
        const start = plotCall.titleNode.getStart(sourceFile);
        const pos = sourceFile.getLineAndCharacterOfPosition(start);
        return Object.freeze({
            file: SCRIPT_FILE_NAME,
            line: pos.line + 1,
            column: pos.character + 1,
        });
    }
    return null;
}

/**
 * Collect every producer-side titled output reachable from the binding
 * at the offset's `<binding>.output("|")` call site. Returns `[]` when
 * the binding is missing or the producer is not a same-file
 * `defineIndicator(...)`.
 *
 * @since 0.7
 * @stable
 * @example
 *     const titles = resolveDepOutputsFor("baseTrend.output(\"\")", 18);
 *     void titles;
 */
export function resolveDepOutputsFor(source: string, offset: number): ReadonlyArray<string> {
    const accessor = findAccessorAtOffset(source, offset);
    if (accessor === null || accessor.kind !== "output") return Object.freeze([]);
    const sourceFile = parse(source);
    const producer = resolveProducerForBinding(sourceFile, accessor.bindingName);
    if (producer === null) return Object.freeze([]);
    return Object.freeze(producer.plotCalls.map((call) => call.title));
}

/**
 * Collect every producer-side input descriptor reachable from the
 * binding at the offset's `<binding>.withInputs({ |})` call site.
 * Returns `[]` when the binding is missing or the producer is not a
 * same-file `defineIndicator(...)`.
 *
 * @since 0.7
 * @stable
 * @example
 *     const inputs = resolveDepInputsFor("baseTrend.withInputs({ })", 22);
 *     void inputs;
 */
export function resolveDepInputsFor(
    source: string,
    offset: number,
): ReadonlyArray<DepInputDescriptor> {
    const accessor = findAccessorAtOffset(source, offset);
    if (accessor === null || accessor.kind !== "withInputs") return Object.freeze([]);
    const sourceFile = parse(source);
    const producer = resolveProducerForBinding(sourceFile, accessor.bindingName);
    if (producer === null) return Object.freeze([]);
    return Object.freeze(producer.inputs);
}

type AccessorHit = Readonly<
    | { kind: "output"; bindingName: string; outputTitle: string | null }
    | { kind: "withInputs"; bindingName: string }
>;

function findAccessorAtOffset(source: string, offset: number): AccessorHit | null {
    const sourceFile = parse(source);
    const token = findTokenAtOffset(sourceFile, offset);
    if (token === null) return null;

    let current: ts.Node | undefined = token;
    while (current !== undefined) {
        if (ts.isCallExpression(current)) {
            const callee = current.expression;
            if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
                const method = callee.name.text;
                if (method === "output") {
                    const arg = current.arguments[0];
                    const title = arg !== undefined && ts.isStringLiteral(arg) ? arg.text : null;
                    return Object.freeze({
                        kind: "output",
                        bindingName: callee.expression.text,
                        outputTitle: title,
                    });
                }
                if (method === "withInputs") {
                    return Object.freeze({
                        kind: "withInputs",
                        bindingName: callee.expression.text,
                    });
                }
            }
        }
        current = current.parent;
    }
    return null;
}

type ProducerInfo = Readonly<{
    plotCalls: ReadonlyArray<Readonly<{ title: string; titleNode: ts.StringLiteral }>>;
    inputs: ReadonlyArray<DepInputDescriptor>;
}>;

function resolveProducerForBinding(
    sourceFile: ts.SourceFile,
    bindingName: string,
): ProducerInfo | null {
    const root = resolveDefineCall(sourceFile, bindingName, new Set());
    if (root === null) return null;
    return extractProducerInfo(root, sourceFile);
}

function resolveDefineCall(
    sourceFile: ts.SourceFile,
    bindingName: string,
    seen: Set<string>,
): ts.CallExpression | null {
    if (seen.has(bindingName)) return null;
    seen.add(bindingName);
    const initializer = findBindingInitializer(sourceFile, bindingName);
    if (initializer === null) return null;
    return unwrapToDefineCall(initializer, sourceFile, seen);
}

function findBindingInitializer(
    sourceFile: ts.SourceFile,
    bindingName: string,
): ts.Expression | null {
    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name)) continue;
            if (declaration.name.text !== bindingName) continue;
            return declaration.initializer ?? null;
        }
    }
    return null;
}

function unwrapToDefineCall(
    node: ts.Expression,
    sourceFile: ts.SourceFile,
    seen: Set<string>,
): ts.CallExpression | null {
    let current: ts.Expression = node;
    while (ts.isCallExpression(current)) {
        const callee = current.expression;
        if (ts.isIdentifier(callee) && callee.text === "defineIndicator") return current;
        if (ts.isPropertyAccessExpression(callee)) {
            // Chain like `baseTrend.withInputs({...}).withInputs({...})`.
            current = callee.expression;
            continue;
        }
        return null;
    }
    if (ts.isIdentifier(current)) {
        // Follow a same-file rebinding chain (e.g. `const chain = root;`).
        return resolveDefineCall(sourceFile, current.text, seen);
    }
    return null;
}

function extractProducerInfo(
    defineCall: ts.CallExpression,
    sourceFile: ts.SourceFile,
): ProducerInfo {
    const opts = defineCall.arguments[0];
    /* v8 ignore start -- defineIndicator(...) without an object literal is a
       compile-time type error that the language service surfaces elsewhere. */
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) {
        return Object.freeze({ plotCalls: Object.freeze([]), inputs: Object.freeze([]) });
    }
    /* v8 ignore stop */

    const computeFn = findPropertyAssignment(opts, "compute");
    const plotCalls = computeFn === null ? [] : collectPlotCalls(computeFn, sourceFile);

    const inputsLiteral = findPropertyAssignment(opts, "inputs");
    const inputs =
        inputsLiteral === null || !ts.isObjectLiteralExpression(inputsLiteral)
            ? []
            : collectInputs(inputsLiteral, sourceFile);

    return Object.freeze({
        plotCalls: Object.freeze(plotCalls.map((entry) => Object.freeze(entry))),
        inputs: Object.freeze(inputs.map((entry) => Object.freeze(entry))),
    });
}

function findPropertyAssignment(
    objectLiteral: ts.ObjectLiteralExpression,
    propertyName: string,
): ts.Expression | null {
    for (const property of objectLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (propertyNameIs(property.name, propertyName)) return property.initializer;
    }
    return null;
}

function collectPlotCalls(
    root: ts.Node,
    sourceFile: ts.SourceFile,
): Array<{ title: string; titleNode: ts.StringLiteral }> {
    const collected: Array<{ title: string; titleNode: ts.StringLiteral }> = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && isPlotCall(node)) {
            const opts = node.arguments[1];
            if (opts !== undefined && ts.isObjectLiteralExpression(opts)) {
                for (const property of opts.properties) {
                    if (!ts.isPropertyAssignment(property)) continue;
                    if (!propertyNameIs(property.name, "title")) continue;
                    const init = property.initializer;
                    if (ts.isStringLiteral(init))
                        collected.push({ title: init.text, titleNode: init });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    void sourceFile;
    return collected;
}

function isPlotCall(call: ts.CallExpression): boolean {
    const callee = call.expression;
    return ts.isIdentifier(callee) && callee.text === "plot";
}

function collectInputs(
    inputsLiteral: ts.ObjectLiteralExpression,
    sourceFile: ts.SourceFile,
): Array<DepInputDescriptor> {
    const out: Array<DepInputDescriptor> = [];
    for (const property of inputsLiteral.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyNameText(property.name);
        if (name === null) continue;
        const init = property.initializer;
        if (!ts.isCallExpression(init)) continue;
        const callee = init.expression;
        if (!ts.isPropertyAccessExpression(callee)) continue;
        if (!ts.isIdentifier(callee.expression) || callee.expression.text !== "input") continue;
        const kind = callee.name.text;
        const firstArg = init.arguments[0];
        const defaultText = firstArg === undefined ? "—" : firstArg.getText(sourceFile);
        out.push({ name, kind, defaultText });
    }
    return out;
}

function propertyNameIs(name: ts.PropertyName, expected: string): boolean {
    return propertyNameText(name) === expected;
}

function propertyNameText(name: ts.PropertyName): string | null {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
        ? name.text
        : null;
}

function formatOutputHover(bindingName: string, producer: ProducerInfo): HoverDoc {
    if (producer.plotCalls.length === 0) {
        return Object.freeze({
            title: `${bindingName}.output(...)`,
            summary:
                'Producer does not expose any titled outputs. Add `plot(value, { title: "<name>" })` calls in the producer\'s `compute` body.',
        });
    }
    const lines = producer.plotCalls.map((call) => `- "${call.title}" — Series<number>`);
    return Object.freeze({
        title: `${bindingName}.output(name)`,
        summary: `Outputs declared by the producer:\n${lines.join("\n")}`,
    });
}

function formatWithInputsHover(bindingName: string, producer: ProducerInfo): HoverDoc {
    if (producer.inputs.length === 0) {
        return Object.freeze({
            title: `${bindingName}.withInputs({})`,
            summary: "Producer does not declare any inputs.",
        });
    }
    const lines = producer.inputs.map(
        (entry) => `- ${entry.name}: ${entry.kind} (default: ${entry.defaultText})`,
    );
    return Object.freeze({
        title: `${bindingName}.withInputs(overrides)`,
        summary: `Producer inputs:\n${lines.join("\n")}`,
    });
}

function parse(source: string): ts.SourceFile {
    return ts.createSourceFile(SCRIPT_FILE_NAME, source, ts.ScriptTarget.Latest, true);
}
